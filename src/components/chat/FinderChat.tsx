'use client';

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';

import { Button } from '@/components/ui/Button';
import { MAX_CHAT_MESSAGE_CHARS, trimChatHistory } from '@/lib/chat/schema';
import { decodeChatEvents, type ClinicRecommendation } from '@/lib/chat/stream-protocol';
import { cn } from '@/lib/cn';
import type { Dictionary } from '@/lib/i18n/dictionary';
import type { RateLimitScope } from '@/lib/rate-limit';

import { ChatNoMatch } from './ChatNoMatch';
import { ClinicRecommendations } from './ClinicRecommendations';

type Role = 'user' | 'assistant';
type Message = {
  role: Role;
  content: string;
  recommendations?: ClinicRecommendation[];
  noMatch?: boolean;
};

/** Display-only opener from /admin/assistant; never sent to the model. */
type FinderChatProps = { dict: Dictionary; rtl: boolean; greeting?: string };

/**
 * The landing-page search card. The first submit seeds the conversation and
 * swaps the card into the chat view in place (locked decision: no /chat page).
 */
export function FinderChat({ dict, rtl, greeting = '' }: FinderChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [limitScope, setLimitScope] = useState<RateLimitScope | null>(null);

  function restart() {
    setMessages([]);
    setInput('');
    setLimitScope(null);
  }

  async function send(content: string) {
    const history = trimChatHistory([...messages, { role: 'user', content }]);
    setMessages((prev) => [...prev, { role: 'user', content }]);
    setInput('');
    setPending(true);
    try {
      const outcome = await streamReply(history, setMessages);
      if (outcome === 'unavailable') {
        setMessages((prev) => [...prev, { role: 'assistant', content: dict.chatDisabled }]);
      } else if (outcome) {
        setMessages((prev) => prev.slice(0, -1));
        setInput(content);
      }
      setLimitScope(outcome === 'unavailable' ? null : outcome);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: dict.chatError }]);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || pending) return;
    void send(content);
  }

  const shared = { dict, rtl, input, setInput, pending, onSubmit: handleSubmit };
  if (messages.length === 0) return <SearchCard {...shared} limitScope={limitScope} />;
  return (
    <ChatCard
      {...shared}
      messages={messages}
      limitScope={limitScope}
      greeting={greeting}
      onRestart={restart}
    />
  );
}

/** `'unavailable'` = the admin switched the assistant off, or it is unconfigured. */
type ReplyOutcome = RateLimitScope | 'unavailable' | null;

async function streamReply(
  messages: Message[],
  setMessages: Dispatch<SetStateAction<Message[]>>,
): Promise<ReplyOutcome> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (response.status === 429) {
    const body = (await response.json().catch(() => null)) as { scope?: string } | null;
    return body?.scope === 'day' ? 'day' : 'minute';
  }
  if (response.status === 503) return 'unavailable';
  if (!response.ok || !response.body) throw new Error('chat request failed');
  await readStream(response.body, setMessages);
  return null;
}

/**
 * Reads the NDJSON reply. Text frames grow the bubble; a clinics frame attaches
 * the recommendation cards to the same assistant message, so they appear inline
 * with the reply that introduces them rather than after the whole run.
 */
async function readStream(
  body: ReadableStream<Uint8Array>,
  setMessages: Dispatch<SetStateAction<Message[]>>,
): Promise<void> {
  setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const reply: Message = { role: 'assistant', content: '' };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = decodeChatEvents(buffer);
    buffer = rest;
    for (const event of events) {
      if (event.t === 'text') reply.content += event.v;
      else if (event.t === 'clinics') reply.recommendations = event.v;
      else reply.noMatch = true;
    }
    const snapshot = { ...reply };
    setMessages((prev) => [...prev.slice(0, -1), snapshot]);
  }
}

type StageProps = {
  dict: Dictionary;
  rtl: boolean;
  input: string;
  setInput: (value: string) => void;
  pending: boolean;
  onSubmit: (event: FormEvent) => void;
  limitScope: RateLimitScope | null;
};

function SearchCard({ dict, rtl, input, setInput, pending, onSubmit, limitScope }: StageProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-[780px] rounded-3xl border border-border bg-surface p-6 text-start shadow-panel sm:p-8"
    >
      <label htmlFor="finder-query" className="mb-3 block text-base font-bold text-primary">
        {dict.searchLabel}
      </label>
      <textarea
        id="finder-query"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={dict.searchPlaceholder}
        maxLength={MAX_CHAT_MESSAGE_CHARS}
        className="min-h-[140px] w-full resize-y rounded-xl border-[1.5px] border-primary/20 bg-surface-tint px-4 py-4 text-[17px] leading-normal outline-none focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
      />
      <p className="mt-3 text-sm leading-normal text-muted">{dict.privacyNote}</p>
      {limitScope && <LimitBanner dict={dict} scope={limitScope} />}
      <div className="mt-5">
        <Button
          type="submit"
          disabled={pending}
          className="gap-2.5 px-7 py-4 text-[17px] font-bold"
        >
          {dict.searchBtn}
          <span aria-hidden className="text-[19px]">
            {rtl ? '←' : '→'}
          </span>
        </Button>
      </div>
    </form>
  );
}

function ChatCard(
  props: StageProps & { messages: Message[]; greeting: string; onRestart: () => void },
) {
  const { dict, messages, pending, limitScope, greeting, onRestart } = props;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, pending]);

  const awaitingReply = pending && messages[messages.length - 1]?.role === 'user';
  return (
    <div className="mx-auto max-w-[780px] rounded-3xl border border-border bg-surface p-4 text-start shadow-panel sm:p-6">
      <div ref={scrollRef} className="max-h-[420px] space-y-4 overflow-y-auto p-1">
        {greeting && (
          <MessageBubble dict={dict} message={{ role: 'assistant', content: greeting }} />
        )}
        {messages.map((message, index) => (
          <div key={index} className="space-y-4">
            <MessageBubble dict={dict} message={message} />
            {message.recommendations && (
              <ClinicRecommendations dict={dict} items={message.recommendations} />
            )}
            {message.noMatch && <ChatNoMatch dict={dict} onRestart={onRestart} />}
          </div>
        ))}
        {awaitingReply && <TypingIndicator dict={dict} />}
      </div>
      {limitScope && <LimitBanner dict={dict} scope={limitScope} />}
      <InputDock {...props} />
    </div>
  );
}

function MessageBubble({ dict, message }: { dict: Dictionary; message: Message }) {
  const isBot = message.role === 'assistant';
  return (
    <div className={cn('flex', isBot ? 'justify-start' : 'justify-end')}>
      <div className={cn('flex max-w-[85%] flex-col gap-1.5', isBot ? 'items-start' : 'items-end')}>
        {isBot && (
          <span className="px-1 text-xs font-bold tracking-wide text-muted">
            {dict.assistantTag}
          </span>
        )}
        <div
          className={cn(
            'rounded-[18px] px-4.5 py-3.5 text-base leading-relaxed whitespace-pre-wrap',
            isBot
              ? 'rounded-es-[4px] border border-border bg-surface text-foreground'
              : 'rounded-ee-[4px] bg-primary text-primary-foreground',
          )}
        >
          {!isBot && <span className="sr-only">Sie: </span>}
          {message.content}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator({ dict }: { dict: Dictionary }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="px-1 text-xs font-bold tracking-wide text-muted">{dict.assistantTag}</span>
      <div className="flex items-center gap-1.5 rounded-[18px] rounded-es-[4px] border border-border bg-surface px-5 py-4">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="block size-2 rounded-full bg-primary animate-[typing-blink_1.3s_infinite]"
            style={{ animationDelay: `${dot * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function LimitBanner({ dict, scope }: { dict: Dictionary; scope: RateLimitScope }) {
  const title = scope === 'day' ? dict.limitDailyTitle : dict.limitMinuteTitle;
  const body = scope === 'day' ? dict.limitDailyBody : dict.limitMinuteBody;
  return (
    <div
      role="alert"
      className="mt-3 flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-start animate-[chat-in_0.3s_ease]"
    >
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-danger text-sm font-extrabold text-danger-foreground"
      >
        !
      </span>
      <div>
        <div className="text-[15px] font-extrabold text-danger">{title}</div>
        <div className="mt-0.5 text-sm leading-normal text-foreground">{body}</div>
      </div>
    </div>
  );
}

function InputDock({ dict, input, setInput, pending, onSubmit }: StageProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit(event);
    }
  }

  function autoGrow() {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
  }

  return (
    <form onSubmit={onSubmit} className="mt-4">
      <div className="flex items-end gap-3 rounded-[18px] border-[1.5px] border-primary/20 bg-surface py-2 ps-4 pe-2 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          maxLength={MAX_CHAT_MESSAGE_CHARS}
          placeholder={dict.chatPlaceholder}
          aria-label={dict.chatPlaceholder}
          onChange={(event) => {
            setInput(event.target.value);
            autoGrow();
          }}
          onKeyDown={handleKeyDown}
          className="max-h-[140px] flex-1 resize-none bg-transparent py-2 text-base leading-normal outline-none"
        />
        <Button
          type="submit"
          aria-label={dict.chatSend}
          disabled={pending || !input.trim()}
          className="size-11 shrink-0 rounded-xl p-0 text-[19px]"
        >
          <span aria-hidden>↑</span>
        </Button>
      </div>
      {input.length >= MAX_CHAT_MESSAGE_CHARS && (
        <div className="mt-1.5 px-1 text-end text-xs text-danger">{dict.charWarn}</div>
      )}
    </form>
  );
}

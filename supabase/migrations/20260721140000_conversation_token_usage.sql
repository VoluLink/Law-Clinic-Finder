-- Per-conversation Claude token usage, summed across the tool-loop's model
-- calls. Feeds the admin dashboard's "API-Kosten (LLM)" figure. Written by the
-- service client on insert; existing conversations keep 0.

alter table public.conversations
  add column input_tokens integer not null default 0,
  add column output_tokens integer not null default 0;

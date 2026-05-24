import { emitKeypressEvents } from "node:readline";

export type SelectorOption<Value extends string> = {
  readonly label: string;
  readonly value: Value;
};

export type SelectorPromptInput<Value extends string> =
  | {
      readonly kind: "single";
      readonly label: string;
      readonly options: readonly SelectorOption<Value>[];
      readonly defaultValue: Value;
    }
  | {
      readonly kind: "multi";
      readonly label: string;
      readonly options: readonly SelectorOption<Value>[];
      readonly defaultValue: readonly Value[];
    };

export type SelectorPromptState<Value extends string = string> = {
  readonly kind: "single" | "multi";
  readonly label: string;
  readonly options: readonly SelectorOption<Value>[];
  readonly highlightedIndex: number;
  readonly selectedValues: readonly Value[];
};

export type SelectorKey = {
  readonly name?: string;
  readonly ctrl?: boolean;
};

export type SelectorPromptPending<Value extends string> = SelectorPromptState<Value> & {
  readonly status: "pending";
};

export type SelectorPromptSubmitted<Value extends string> = SelectorPromptState<Value> & {
  readonly status: "submitted";
  readonly value: Value | readonly Value[];
};

export type SelectorPromptResult<Value extends string> =
  | SelectorPromptPending<Value>
  | SelectorPromptSubmitted<Value>;

export const createSelectorPromptState = <Value extends string>(
  input: SelectorPromptInput<Value>,
): SelectorPromptState<Value> => {
  if (input.options.length === 0) {
    throw new Error("Selector prompt requires at least one option.");
  }

  const defaultValues =
    input.kind === "single" ? [input.defaultValue] : Array.from(new Set(input.defaultValue));
  const highlightedIndex = Math.max(
    0,
    input.options.findIndex((option) => defaultValues.includes(option.value)),
  );

  return {
    kind: input.kind,
    label: input.label,
    options: input.options,
    highlightedIndex,
    selectedValues:
      input.kind === "single"
        ? [input.options[highlightedIndex]?.value ?? input.options[0].value]
        : defaultValues,
  };
};

export const renderSelectorPrompt = (state: SelectorPromptState): string => {
  const help =
    state.kind === "multi"
      ? "Use ↑/↓ to move, Space toggles, Enter confirms"
      : "Use ↑/↓ to move, Enter to confirm";
  const lines = [`${state.label}`, help];

  for (const [index, option] of state.options.entries()) {
    const cursor = index === state.highlightedIndex ? "›" : " ";
    const selected = state.selectedValues.includes(option.value);
    const marker = state.kind === "multi" ? (selected ? "☑" : "☐") : selected ? "◉" : "○";
    lines.push(`${cursor} ${marker} ${option.label}`);
  }

  return `${lines.join("\n")}\n`;
};

const moveHighlight = <Value extends string>(
  state: SelectorPromptState<Value>,
  offset: number,
): SelectorPromptState<Value> => ({
  ...state,
  highlightedIndex: (state.highlightedIndex + offset + state.options.length) % state.options.length,
});

const toggleHighlighted = <Value extends string>(
  state: SelectorPromptState<Value>,
): SelectorPromptState<Value> => {
  const value = state.options[state.highlightedIndex]?.value;
  if (value === undefined) {
    return state;
  }

  if (state.kind === "single") {
    return { ...state, selectedValues: [value] };
  }

  return state.selectedValues.includes(value)
    ? { ...state, selectedValues: state.selectedValues.filter((selected) => selected !== value) }
    : { ...state, selectedValues: [...state.selectedValues, value] };
};

export const updateSelectorPromptState = <Value extends string>(
  state: SelectorPromptState<Value>,
  key: SelectorKey,
): SelectorPromptResult<Value> => {
  if (key.ctrl === true && key.name === "c") {
    throw new Error("Selector prompt cancelled.");
  }

  if (key.name === "up") {
    return { ...moveHighlight(state, -1), status: "pending" };
  }
  if (key.name === "down") {
    return { ...moveHighlight(state, 1), status: "pending" };
  }
  if (key.name === "space") {
    return { ...toggleHighlighted(state), status: "pending" };
  }
  if (key.name === "return" || key.name === "enter") {
    if (state.kind === "single") {
      const selected = state.options[state.highlightedIndex]?.value ?? state.options[0].value;
      return { ...state, selectedValues: [selected], status: "submitted", value: selected };
    }
    return { ...state, status: "submitted", value: state.selectedValues };
  }

  return { ...state, status: "pending" };
};

export type SelectorPromptStreams = {
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WriteStream;
};

export const runSelectorPrompt = async <Value extends string>(
  input: SelectorPromptInput<Value>,
  streams: SelectorPromptStreams = { input: process.stdin, output: process.stdout },
): Promise<Value | readonly Value[]> => {
  let state = createSelectorPromptState(input);
  const wasRaw = streams.input.isRaw;
  const canRawMode = typeof streams.input.setRawMode === "function";
  const render = (): void => {
    streams.output.write("\u001B[2J\u001B[0;0H");
    streams.output.write(renderSelectorPrompt(state));
  };

  emitKeypressEvents(streams.input);
  if (canRawMode) {
    streams.input.setRawMode(true);
  }
  streams.input.resume();
  render();

  return await new Promise<Value | readonly Value[]>((resolve, reject) => {
    const cleanup = (): void => {
      streams.input.off("keypress", onKeypress);
      if (canRawMode) {
        streams.input.setRawMode(wasRaw);
      }
      streams.output.write("\n");
    };
    const onKeypress = (_chunk: string, key: SelectorKey): void => {
      try {
        const next = updateSelectorPromptState(state, key);
        state = next;
        render();
        if (next.status === "submitted") {
          cleanup();
          resolve(next.value);
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    streams.input.on("keypress", onKeypress);
  });
};

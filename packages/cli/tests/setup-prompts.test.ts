import { describe, expect, it } from "vitest";
import {
  createSelectorPromptState,
  renderSelectorPrompt,
  updateSelectorPromptState,
} from "../src/setup-prompts.js";

describe("setup hybrid selector prompts", () => {
  it("renders single-choice prompts as a selector and confirms the highlighted option", () => {
    let state = createSelectorPromptState({
      kind: "single",
      label: "Agent reasoning effort",
      options: [
        { label: "low", value: "low" },
        { label: "medium", value: "medium" },
        { label: "high", value: "high" },
        { label: "xhigh", value: "xhigh" },
      ],
      defaultValue: "medium",
    });

    expect(renderSelectorPrompt(state)).toContain("Use ↑/↓ to move, Enter to confirm");
    expect(renderSelectorPrompt(state)).toContain("› ◉ medium");

    state = updateSelectorPromptState(state, { name: "down" });
    const result = updateSelectorPromptState(state, { name: "return" });

    expect(result.status).toBe("submitted");
    expect(result.value).toBe("high");
  });

  it("toggles multi-choice prompts with Space and confirms with Enter", () => {
    let state = createSelectorPromptState({
      kind: "multi",
      label: "Required auth env keys",
      options: [
        { label: "OPENAI_API_KEY", value: "OPENAI_API_KEY" },
        { label: "ANTHROPIC_API_KEY", value: "ANTHROPIC_API_KEY" },
      ],
      defaultValue: ["OPENAI_API_KEY"],
    });

    expect(renderSelectorPrompt(state)).toContain("Space toggles, Enter confirms");
    expect(renderSelectorPrompt(state)).toContain("› ☑ OPENAI_API_KEY");

    state = updateSelectorPromptState(state, { name: "space" });
    state = updateSelectorPromptState(state, { name: "down" });
    state = updateSelectorPromptState(state, { name: "space" });
    const result = updateSelectorPromptState(state, { name: "return" });

    expect(result.status).toBe("submitted");
    expect(result.value).toEqual(["ANTHROPIC_API_KEY"]);
  });
});

import { render } from "@testing-library/svelte";
import { expect } from "chai";
import App from "./App.svelte";

describe("<App>", () => {
  it("should renders microlambda title", () => {
    const { getByText } = render(App);
    const title = getByText(/Microλambda/i);
    expect(document.body.contains(title));
  });
});

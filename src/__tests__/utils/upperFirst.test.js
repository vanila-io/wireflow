import { upperFirst } from "../../utils";

describe("upperFirst", () => {
    it("should return one word with only first letter capitalised when one word is passed in", () => {
        const result = upperFirst("wIREfloW");
        expect(result).toEqual("Wireflow");
    });

    it("should return each word having only first letter capitalised when multiple words are passed in", () => {
        const result = upperFirst("hello, wIREfloW PEOPLE");
        expect(result).toEqual("Hello, Wireflow People");
    });
})
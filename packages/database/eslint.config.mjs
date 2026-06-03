import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        ignores: ["dist/**", "src/generated/**"],
    },
);

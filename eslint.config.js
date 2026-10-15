import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Fuso: cortar o ISO de uma data dá o dia UTC — entre 21h e meia-noite de Brasília
    // já é o dia seguinte. Usar src/lib/dataBrasilia.ts: dataBrasiliaISO(new Date(iso))
    // para o dia e limitesDiaBrasilia("AAAA-MM-DD") para filtros .gte()/.lte().
    // "warn" de propósito: há usos antigos listados em DIVIDA-TECNICA.md.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/dataBrasilia.ts", "src/integrations/**"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "CallExpression[callee.property.name='slice'][arguments.length=2][arguments.0.value=0][arguments.1.value=10]:matches([callee.object.callee.property.name='toISOString'], [callee.object.callee.name='String'], [callee.object.name=/(data|date|iso|_at$|dataRef)/i], [callee.object.property.name=/(data|date|iso|_at$)/i])",
          message:
            "Fuso: .slice(0, 10) numa data dá o dia UTC (21h–24h de Brasília vira o dia seguinte). Use dataBrasiliaISO(new Date(valor)) de @/lib/dataBrasilia.",
        },
        {
          selector:
            "MemberExpression[computed=true][property.value=0][object.type='CallExpression'][object.callee.property.name='split'][object.arguments.0.value='T']",
          message:
            "Fuso: .split(\"T\")[0] numa data dá o dia UTC. Use dataBrasiliaISO(new Date(valor)) de @/lib/dataBrasilia.",
        },
        {
          selector:
            "CallExpression[callee.property.name='substring'][arguments.0.value=0][arguments.1.value=10][callee.object.callee.property.name='toISOString']",
          message:
            "Fuso: toISOString().substring(0, 10) dá o dia UTC. Use dataBrasiliaISO() de @/lib/dataBrasilia.",
        },
        {
          selector: "TemplateElement[value.raw=/^T23:59:59/], Literal[value=/^T23:59:59/]",
          message:
            "Fuso: \"…T23:59:59\" sem fuso é lido em UTC pelo banco (20:59:59 de Brasília). Use limitesDiaBrasilia(dia).fimISO de @/lib/dataBrasilia.",
        },
      ],
    },
  },
);

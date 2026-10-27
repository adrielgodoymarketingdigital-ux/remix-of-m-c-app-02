import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function SeletorTema() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation("configuracoes");

  // Evita hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">{t("tema.titulo")}</CardTitle>
        <CardDescription className="text-sm">
          {t("tema.descricao")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={theme}
          onValueChange={setTheme}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div>
            <RadioGroupItem
              value="light"
              id="theme-light"
              className="peer sr-only"
            />
            <Label
              htmlFor="theme-light"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
            >
              <Sun className="mb-3 h-6 w-6" />
              <span className="text-sm font-medium">{t("tema.claro")}</span>
            </Label>
          </div>

          <div>
            <RadioGroupItem
              value="dark"
              id="theme-dark"
              className="peer sr-only"
            />
            <Label
              htmlFor="theme-dark"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
            >
              <Moon className="mb-3 h-6 w-6" />
              <span className="text-sm font-medium">{t("tema.escuro")}</span>
            </Label>
          </div>

          <div>
            <RadioGroupItem
              value="system"
              id="theme-system"
              className="peer sr-only"
            />
            <Label
              htmlFor="theme-system"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
            >
              <Monitor className="mb-3 h-6 w-6" />
              <span className="text-sm font-medium">{t("tema.sistema")}</span>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

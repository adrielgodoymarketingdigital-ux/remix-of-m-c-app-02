// Select do Radix trocado por botões (o Radix Select não abre em jsdom).
import { createContext, useContext, type ReactNode } from "react";
const Ctx = createContext<(v: string) => void>(() => {});
export function Select({ onValueChange, children }: { onValueChange?: (v: string) => void; children: ReactNode }) {
  return <Ctx.Provider value={onValueChange ?? (() => {})}><div>{children}</div></Ctx.Provider>;
}
export const SelectTrigger = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
export const SelectValue = () => null;
export const SelectContent = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
export const SelectGroup = SelectContent;
export const SelectLabel = SelectContent;
export const SelectSeparator = () => null;
export function SelectItem({ value, children }: { value: string; children?: ReactNode }) {
  const escolher = useContext(Ctx);
  return <button type="button" data-select-item={value} onClick={() => escolher(value)}>{children}</button>;
}

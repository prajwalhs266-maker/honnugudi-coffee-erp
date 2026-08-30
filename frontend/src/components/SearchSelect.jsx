import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check } from "lucide-react";

export const SearchSelect = ({ options, value, onChange, placeholder = "Select...", testId, className = "" }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          data-testid={testId}
          className={`w-full justify-between font-normal border-[#E5D9C8] bg-white hover:bg-[#FAF7F2] ${className}`}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search..." data-testid={testId ? `${testId}-search` : undefined} />
          <CommandList>
            <CommandEmpty>No match found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  data-testid={testId ? `${testId}-option-${o.value}` : undefined}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 ${o.value === value ? "opacity-100" : "opacity-0"}`} />
                  <div>
                    <div>{o.label}</div>
                    {o.sub && <div className="text-xs text-slate-500">{o.sub}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

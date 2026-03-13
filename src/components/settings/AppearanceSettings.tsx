import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useThemePreferences } from "@/hooks/useThemePreferences";
import { Sun, Moon } from "lucide-react";

export default function AppearanceSettings() {
  const { theme, setTheme } = useThemePreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize how the application looks on your device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Theme</Label>
          <RadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as 'light' | 'dark')}
            className="grid grid-cols-2 gap-4"
          >
            <Label
              htmlFor="light"
              className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="light" id="light" />
              <Sun className="w-5 h-5" />
              <span>Light</span>
            </Label>
            <Label
              htmlFor="dark"
              className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="dark" id="dark" />
              <Moon className="w-5 h-5" />
              <span>Dark</span>
            </Label>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}

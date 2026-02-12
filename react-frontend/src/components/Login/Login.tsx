import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import AuthBackgroundShape from '../../assets/svg/auth-background-shape';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function Login() {
  const { signInWithGoogle, loading } = useAuth();
  const [checked1, setChecked1] = useState(false);
  const [checked2, setChecked2] = useState(false);
  const [checked3, setChecked3] = useState(false);

  const canSignIn = checked1 && checked2 && checked3;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-black px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute">
        <AuthBackgroundShape />
      </div>

      <Card className="relative z-10 w-full max-w-lg border-none shadow-md sm:max-w-lg">
        <CardHeader className="space-y-1.5 text-center">
          <CardTitle className="text-2xl tracking-[0.2em] uppercase font-light">
            Template Checker
          </CardTitle>
          <CardDescription className="text-base">
            Validate and check Frontify templates
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border/80 bg-muted/30 p-4">
            <p className="text-sm italic leading-relaxed text-muted-foreground">
              I know these acknowledgments are annoying but I want to make sure
              expectations surrounding the template checker are set.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3 space-y-0">
              <Checkbox
                id="ack1"
                checked={checked1}
                onCheckedChange={(value) => setChecked1(value === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="ack1"
                className="cursor-pointer text-sm font-normal leading-relaxed text-foreground"
              >
                I understand this is a workaround{' '}
                <strong className="font-semibold">NOT A SOLUTION</strong>.
              </Label>
            </div>
            <div className="flex items-start gap-3 space-y-0">
              <Checkbox
                id="ack2"
                checked={checked2}
                onCheckedChange={(value) => setChecked2(value === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="ack2"
                className="cursor-pointer text-sm font-normal leading-relaxed text-foreground"
              >
                I understand this is River&apos;s weekend project and{' '}
                <strong className="font-semibold">
                  not a Frontify sponsored Template Checker.
                </strong>
              </Label>
            </div>
            <div className="flex items-start gap-3 space-y-0">
              <Checkbox
                id="ack3"
                checked={checked3}
                onCheckedChange={(value) => setChecked3(value === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="ack3"
                className="cursor-pointer text-sm font-normal leading-relaxed text-foreground"
              >
                I understand there is{' '}
                <strong className="font-semibold">
                  no expectation of maintenance
                </strong>
                .
              </Label>
            </div>
          </div>

          <Button
            className="h-12 w-full text-base font-medium"
            onClick={signInWithGoogle}
            disabled={!canSignIn || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <GoogleIcon className="h-5 w-5" />
                Sign in with Google
              </>
            )}
          </Button>

          <Separator />

          <p className="text-center text-xs italic leading-relaxed text-muted-foreground">
            PS: If the template checker saved your day, feel free to send a beer{' '}
            <span className="whitespace-nowrap">my way 😉</span>
            <br />
            Cheers to debugging🍺 — River
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

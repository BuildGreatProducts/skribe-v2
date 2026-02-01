import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Create your account
          </h1>
          <p className="mt-2 text-muted-foreground">
            Start your 3-day free trial with full access
          </p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "rounded-2xl shadow-lg bg-white",
            },
          }}
        />
      </div>
    </div>
  );
}

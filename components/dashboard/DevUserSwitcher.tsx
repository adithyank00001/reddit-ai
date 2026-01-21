"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { switchUser, createUser } from "@/app/actions/dev-auth";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp, UserSearch } from "lucide-react";

export function DevUserSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSwitchUser(email: string) {
    if (!email.trim()) {
      toast.error("Please enter an email");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await switchUser(email);
      if (result.success) {
        toast.success(`Switched to user: ${email}`);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to switch user");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateUser(formData: FormData) {
    const email = formData.get("email") as string;
    if (!email?.trim()) {
      toast.error("Please enter an email");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createUser(formData);
      if (result.success) {
        const message = result.existing
          ? `User already exists. Switched to: ${email}`
          : `User created and signed in: ${email}`;
        toast.success(message);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to create user");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mb-4 border-orange-500/50 bg-orange-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserSearch className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-lg">Dev Mode User Switcher</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="h-8 w-8"
          >
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <CardDescription className="text-xs">
          Quickly switch between users or create new test accounts (Dev mode only)
        </CardDescription>
      </CardHeader>

      {isOpen && (
        <CardContent>
          <Tabs defaultValue="switch" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="switch">Switch User</TabsTrigger>
              <TabsTrigger value="create">Create User</TabsTrigger>
            </TabsList>

            <TabsContent value="switch" className="space-y-4 mt-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const email = formData.get("email") as string;
                  handleSwitchUser(email);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="switch-email">Email</Label>
                  <Input
                    id="switch-email"
                    name="email"
                    type="email"
                    placeholder="user@example.com"
                    required
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter an existing user's email to switch accounts
                  </p>
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Switch User
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="create" className="space-y-4 mt-4">
              <form
                action={handleCreateUser}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input
                    id="create-email"
                    name="email"
                    type="email"
                    placeholder="user@example.com"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subreddit">Subreddits (Optional)</Label>
                  <Input
                    id="subreddit"
                    name="subreddit"
                    placeholder="saas, entrepreneur, startups"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated subreddits to monitor (without r/)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keywords">Keywords (Optional)</Label>
                  <Input
                    id="keywords"
                    name="keywords"
                    placeholder="saas, startup, marketing"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated keywords for project settings
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productDescription">Product Description (Optional)</Label>
                  <Textarea
                    id="productDescription"
                    name="productDescription"
                    placeholder="Describe your product or service..."
                    rows={4}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Product description for project settings
                  </p>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create & Sign In
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}

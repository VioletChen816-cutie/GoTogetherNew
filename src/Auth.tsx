import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./client";
import { Button } from "./components/button";
import { Input } from "./components/input";
import { Label } from "./components/label";
import { useToast } from "./components/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/card";
import { RadioGroup, RadioGroupItem } from "./components/radio-group";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"passenger" | "driver">("passenger");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log("Starting sign up with:", { email, fullName, role });
      const redirectUrl = `${window.location.origin}/`;
      console.log("Auth emailRedirectTo:", redirectUrl);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      console.log("Sign up response:", { data, error });

      if (error) {
        console.error("Sign up error:", {
          name: (error as any)?.name,
          message: (error as any)?.message,
          status: (error as any)?.status,
          code: (error as any)?.code,
        });
        throw error;
      }

      if (data.user) {
        // Wait for session to stabilize before any profile operations
        await new Promise(resolve => setTimeout(resolve, 600));
        const { data: sessionData } = await supabase.auth.getSession();

        // Check if profile was created by the trigger
        const { data: profileData, error: profileCheckError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .single();

        console.log("Profile check:", { profileData, profileCheckError });

        if (profileCheckError && profileCheckError.code !== 'PGRST116') {
          console.error("Database error checking profile:", {
            message: profileCheckError.message,
            code: profileCheckError.code,
            details: (profileCheckError as any)?.details,
            hint: (profileCheckError as any)?.hint,
          });
          throw new Error(`Database error: ${profileCheckError.message}`);
        }

        if (!profileData && profileCheckError?.code === 'PGRST116') {
           // Profile doesn't exist, the trigger might have failed due to RLS
           console.error("Profile was not created by trigger, attempting manual creation");
           
           // Wait a moment to ensure the user session is properly established
           await new Promise(resolve => setTimeout(resolve, 500));
           
           // Only attempt RPC/manual insert if we have a session
           if (sessionData?.session) {
             // Try using the SQL function first (if available)
             const { error: functionError } = await supabase.rpc('create_user_profile', {
               user_id: data.user.id,
               full_name: fullName,
               user_role: role,
               phone_number: phone || null
             });
             
             if (functionError) {
               console.warn("SQL function failed, trying direct insert:", {
                 message: functionError.message,
                 code: functionError.code,
                 details: (functionError as any)?.details,
                 hint: (functionError as any)?.hint,
               });
               
               // Fallback to direct insert
               const { error: manualProfileError } = await supabase
                 .from("profiles")
                 .insert({
                   id: data.user.id,
                   full_name: fullName,
                   role: role,
                   phone: phone || null
                 });
               
               if (manualProfileError) {
                 console.error("Manual profile creation failed:", {
                   message: manualProfileError.message,
                   code: manualProfileError.code,
                   details: (manualProfileError as any)?.details,
                   hint: (manualProfileError as any)?.hint,
                 });
                 throw new Error(`Failed to create user profile: ${manualProfileError.message}`);
               }
             }
           } else {
             console.warn("No session available after sign up; skipping profile creation until first sign-in.");
           }
         } else if (phone) {
          // Profile exists, update with phone number
          const { error: phoneUpdateError } = await supabase
            .from("profiles")
            .update({ phone })
            .eq("id", data.user.id);
          
          if (phoneUpdateError) {
            console.warn("Could not update phone number:", {
              message: phoneUpdateError.message,
              code: phoneUpdateError.code,
              details: (phoneUpdateError as any)?.details,
              hint: (phoneUpdateError as any)?.hint,
            });
          }
        }
      }

      toast({
        title: "Account created!",
        description: "Welcome to GoTogether! You can now start using the app.",
      });
      navigate("/");
    } catch (error: any) {
      console.error("Sign up failed:", {
        name: error?.name,
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack,
      });
      const extra = [
        error?.status ? `status ${error.status}` : null,
        error?.code ? `code ${error.code}` : null,
      ].filter(Boolean).join(" | ");
      toast({
        title: "Sign up failed",
        description: `${error?.message || "An unexpected error occurred."}${extra ? ` (${extra})` : ""}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-800">GoTogether</CardTitle>
          <CardDescription>Your friendly ridesharing community</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <Label htmlFor="signup-phone">Phone (optional)</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label>I want to use GoTogether as a:</Label>
                  <RadioGroup value={role} onValueChange={(value) => setRole(value as "passenger" | "driver")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="passenger" id="passenger" />
                      <Label htmlFor="passenger">Passenger</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="driver" id="driver" />
                      <Label htmlFor="driver">Driver</Label>
                    </div>
                  </RadioGroup>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;

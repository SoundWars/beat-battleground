import { motion } from "framer-motion";
import { useState } from "react";
import { Music2, User, Mail, Lock, Mic2, Users } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

type UserType = "artist" | "voter";

const Register = () => {
  const [userType, setUserType] = useState<UserType>("voter");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    artistName: "",
    genre: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Will be connected to backend later
    console.log("Registration data:", { userType, ...formData });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto"
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-[hsl(174,84%,50%)] to-[hsl(200,90%,50%)] flex items-center justify-center mx-auto mb-4">
                <Music2 className="w-8 h-8 text-[hsl(220,20%,4%)]" />
              </div>
              <h1 className="font-display text-3xl font-bold mb-2">Join SoundWars</h1>
              <p className="text-muted-foreground">
                Create your account to compete or vote
              </p>
            </div>

            {/* User Type Toggle */}
            <div className="glass rounded-xl p-2 flex gap-2 mb-8">
              <button
                onClick={() => setUserType("voter")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${
                  userType === "voter"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="w-4 h-4" />
                I Want to Vote
              </button>
              <button
                onClick={() => setUserType("artist")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${
                  userType === "artist"
                    ? "bg-gradient-to-r from-[hsl(280,80%,60%)] to-[hsl(320,80%,55%)] text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Mic2 className="w-4 h-4" />
                I'm an Artist
              </button>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    className="pl-10"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-10"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              {userType === "artist" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="artistName">Artist / Stage Name</Label>
                    <div className="relative">
                      <Mic2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="artistName"
                        placeholder="Your artist name"
                        className="pl-10"
                        value={formData.artistName}
                        onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="genre">Music Genre</Label>
                    <Input
                      id="genre"
                      placeholder="e.g., Electronic, Hip-Hop, Pop"
                      value={formData.genre}
                      onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a password"
                    className="pl-10"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    className="pl-10"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Button type="submit" variant="hero" size="lg" className="w-full">
                {userType === "artist" ? "Register as Artist" : "Create Account"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </form>

            {userType === "artist" && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-sm text-muted-foreground mt-6"
              >
                After registration, you'll be able to upload your track in the dashboard.
              </motion.p>
            )}
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Register;

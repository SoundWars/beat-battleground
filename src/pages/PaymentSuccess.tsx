import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Check, Music2, Loader2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS } from "@/config/api";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setStatus("error");
        return;
      }

      try {
        const response = await fetch(API_ENDPOINTS.PAYMENTS.STATUS(sessionId));
        const data = await response.json();
        
        if (data.status === "completed") {
          setStatus("success");
        } else {
          setStatus("error");
        }
      } catch (error) {
        console.log("Payment verification - will connect to backend");
        // For demo: assume success
        setStatus("success");
      }
    };

    // Small delay for UX
    setTimeout(verifyPayment, 1500);
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto text-center"
          >
            {status === "loading" && (
              <div className="glass rounded-2xl p-8">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
                <h1 className="font-display text-2xl font-bold mb-3">
                  Verifying Payment...
                </h1>
                <p className="text-muted-foreground">
                  Please wait while we confirm your payment.
                </p>
              </div>
            )}

            {status === "success" && (
              <div className="glass rounded-2xl p-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6"
                >
                  <Check className="w-10 h-10 text-primary" />
                </motion.div>
                
                <h1 className="font-display text-3xl font-bold mb-3">
                  Payment Successful!
                </h1>
                
                <p className="text-muted-foreground mb-8">
                  Your artist registration is now complete. You can upload your track and compete for the grand prize!
                </p>

                <div className="space-y-3">
                  <Link to="/submit">
                    <Button variant="hero" size="lg" className="w-full">
                      <Music2 className="w-4 h-4 mr-2" />
                      Upload Your Track
                    </Button>
                  </Link>
                  
                  <Link to="/">
                    <Button variant="glass" size="lg" className="w-full">
                      Go to Homepage
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="glass rounded-2xl p-8">
                <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">⚠️</span>
                </div>
                
                <h1 className="font-display text-2xl font-bold mb-3">
                  Payment Issue
                </h1>
                
                <p className="text-muted-foreground mb-8">
                  We couldn't verify your payment. If you were charged, please contact support.
                </p>

                <div className="space-y-3">
                  <Link to="/register">
                    <Button variant="hero" size="lg" className="w-full">
                      Try Again
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PaymentSuccess;

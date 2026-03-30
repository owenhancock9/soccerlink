import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe() {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("Stripe Secret Key is not defined in environment variables.");
    return null;
  }

  stripeInstance = new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: ("2024-12-18" as any),
    appInfo: {
      name: "CoachMatching",
      version: "1.0.0",
    },
  });

  return stripeInstance;
}

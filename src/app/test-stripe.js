const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
async function test() {
  try {
    const account = await stripe.accounts.create({ type: "express" });
    console.log("Success! Account ID:", account.id);
  } catch (err) {
    console.error("Stripe Error:", err.message);
  }
}
test();

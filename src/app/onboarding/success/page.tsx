import { redirect } from 'next/navigation';

/**
 * Old payment-confirmation page. Payment success is now confirmed with Stripe on the company setup
 * page (or the Billing page), so this page never shows a receipt of its own — it forwards to the
 * plans page, which sends people who have really paid straight on to company setup.
 */
export default function OnboardingSuccessPage() {
  redirect('/onboarding/plans');
}

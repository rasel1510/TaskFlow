import { redirect } from 'next/navigation';

/**
 * The old in-app card form is gone: card details are only ever entered on Stripe's secure
 * Checkout page, which is opened from the plans page. Old links land there.
 */
export default function OnboardingPaymentPage() {
  redirect('/onboarding/plans');
}

import { Check, UserCheck, CreditCard } from 'lucide-react';

interface EnrollStepIndicatorProps {
  currentStep: 'auth' | 'payment';
}

export const EnrollStepIndicator = ({ currentStep }: EnrollStepIndicatorProps) => {
  const isPayment = currentStep === 'payment';

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {/* Step 1 */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        isPayment ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-primary text-primary-foreground'
      }`}>
        {isPayment ? <Check className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
        <span className="hidden sm:inline">Verify Identity</span>
        <span className="sm:hidden">1</span>
      </div>

      {/* Connector */}
      <div className={`w-8 h-0.5 ${isPayment ? 'bg-primary' : 'bg-muted-foreground/30'}`} />

      {/* Step 2 */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        isPayment ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        <CreditCard className="h-4 w-4" />
        <span className="hidden sm:inline">Payment</span>
        <span className="sm:hidden">2</span>
      </div>
    </div>
  );
};

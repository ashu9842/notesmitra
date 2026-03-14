import { useState, useCallback } from "react";
import { Wallet as WalletIcon, IndianRupee, ArrowUpRight, ArrowDownRight, Clock, Eye, EyeOff, Search, CalendarDays, X, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { formatClientErrorMessage } from "../../utils/errorMessages";

interface Transaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  date: string;
  status: "completed" | "pending";
}

interface WalletProps {
  balance: number;
  transactions: Transaction[];
  onWithdraw: (amount: number, upiId: string) => Promise<void>;
  onTopUp?: (amount: number) => Promise<void>;
  onRefresh?: () => Promise<void>;
  isAdmin?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  totalEarningsOverride?: number;
  availableBalanceOverride?: number;
}

export function Wallet({ balance, transactions, onWithdraw, onTopUp, onRefresh, isAdmin = false, isLoading = false, errorMessage, totalEarningsOverride, availableBalanceOverride }: WalletProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try { await onRefresh(); } finally { setIsRefreshing(false); }
  }, [onRefresh, isRefreshing]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [isTopUpDialogOpen, setIsTopUpDialogOpen] = useState(false);
  const [isTopUpProcessing, setIsTopUpProcessing] = useState(false);
  const [txnSearch, setTxnSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const TXN_PAGE_SIZE = 10;

  // Filter transactions for admin - only show platform earnings
  const displayTransactions = isAdmin 
    ? transactions
        .filter(t => 
          t.description.includes("Platform Fee") || 
          t.description.includes("Premium") ||
          t.description.includes("Featured Note") ||
          t.description.includes("Withdrawal")
        )
        .map(t => {
          let label = t.description;
          if (typeof label === 'string' && label.toLowerCase().includes('gateway 0%')) {
            label = label.replace(/Platform Fee \(Gateway 0% \+ Service 20%\)/i, 'Platform Fee (with discounted)');
          } else if (typeof label === 'string' && label.toLowerCase().includes('gateway 2%')) {
            label = label.replace(/Platform Fee \(Gateway 2% \+ Service 20%\)/i, 'Platform Fee');
          }
          return { ...t, description: label };
        })
    : transactions;

  const amount = parseFloat(withdrawAmount) || 0;
  const effectiveAvailableBalance = Math.max(0, Number(availableBalanceOverride ?? balance));
  const isValidAmount = isAdmin 
    ? amount >= 100 && amount <= Math.min(effectiveAvailableBalance, 1000)
    : amount >= 100 && amount <= Math.min(effectiveAvailableBalance, 500);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    
    if (!amount || amount <= 0) {
      toast.error(formatClientErrorMessage("Please enter a valid amount"));
      return;
    }

    if (amount < 100) {
      toast.error(formatClientErrorMessage("Minimum withdrawal amount is ₹100"));
      return;
    }

    if (amount > (isAdmin ? 1000 : 500)) {
      toast.error(formatClientErrorMessage(isAdmin ? "Maximum withdrawal amount is ₹1000" : "Maximum withdrawal amount is ₹500"));
      return;
    }

    if (amount > effectiveAvailableBalance) {
      toast.error(formatClientErrorMessage("Insufficient balance"));
      return;
    }

    if (!upiId.trim()) {
      toast.error(formatClientErrorMessage("Please enter UPI ID"));
      return;
    }

    // Validate UPI ID format
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    if (!upiRegex.test(upiId.trim())) {
      toast.error(formatClientErrorMessage("Please enter a valid UPI ID (e.g., yourname@upi)"));
      return;
    }

    setIsProcessing(true);
    try {
      await onWithdraw(amount, upiId);
      toast.success(`₹${amount} withdrawal initiated to ${upiId}. Funds arrive within 1–2 business days.`);
      setIsWithdrawDialogOpen(false);
      setWithdrawAmount("");
      setUpiId("");
    } catch (error: any) {
      toast.error(formatClientErrorMessage(error, "Withdrawal failed. Please try again."));
    } finally {
      setIsProcessing(false);
    }
  };

  // Earnings = only real sale credits, not wallet recharges/top-ups
  const totalEarnings = totalEarningsOverride !== undefined
    ? totalEarningsOverride
    : transactions
        .filter(t =>
          t.type === "credit" &&
          t.status === "completed" &&
          !t.description.toLowerCase().includes("recharge") &&
          !t.description.toLowerCase().includes("top up") &&
          !t.description.toLowerCase().includes("topup") &&
          !t.description.toLowerCase().includes("add funds")
        )
        .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawals = transactions
    .filter(t =>
      t.type === "debit" &&
      t.status === "completed" &&
      t.description.toLowerCase().startsWith("withdrawal")
    )
    .reduce((sum, t) => sum + t.amount, 0);

  if (errorMessage) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-red-600">
          {formatClientErrorMessage(errorMessage)}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading wallet...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Available Balance */}
        <div className="relative bg-white dark:bg-card rounded-2xl p-5 border border-emerald-100/80 dark:border-emerald-900/40 hover:border-emerald-200 dark:hover:border-emerald-800/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-3xl bg-gradient-to-bl from-emerald-100 dark:from-emerald-900/50 to-transparent opacity-40 pointer-events-none" />
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
                <WalletIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {showBalance ? `₹${effectiveAvailableBalance.toFixed(2)}` : "₹••••••"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBalance(!showBalance)}
              className="hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-muted-foreground -mt-1 -mr-1"
            >
              {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Total Earnings */}
        <div className="relative bg-white dark:bg-card rounded-2xl p-5 border border-indigo-100/80 dark:border-indigo-900/40 hover:border-indigo-200 dark:hover:border-indigo-800/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-3xl bg-gradient-to-bl from-indigo-100 dark:from-indigo-900/50 to-transparent opacity-40" />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shrink-0 shadow-sm">
              <ArrowDownRight className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Earnings</p>
              <p className="text-2xl font-extrabold tracking-tight text-indigo-700 dark:text-indigo-400 mt-0.5">₹{totalEarnings.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Total Withdrawals */}
        <div className="relative bg-white dark:bg-card rounded-2xl p-5 border border-violet-100/80 dark:border-violet-900/40 hover:border-violet-200 dark:hover:border-violet-800/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-3xl bg-gradient-to-bl from-violet-100 dark:from-violet-900/50 to-transparent opacity-40" />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0 shadow-sm">
              <ArrowUpRight className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Withdrawals</p>
              <p className="text-2xl font-extrabold tracking-tight text-violet-700 dark:text-violet-400 mt-0.5">₹{totalWithdrawals.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Up Card - only show if onTopUp handler is provided and not admin */}
      {onTopUp && !isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Add Money to Wallet</CardTitle>
              <Dialog open={isTopUpDialogOpen} onOpenChange={setIsTopUpDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <IndianRupee className="w-4 h-4 mr-2" />
                    Top Up Wallet
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Top Up Wallet</DialogTitle>
                    <DialogDescription>
                      Add real money via UPI to your wallet.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="topup-amount">Amount (₹)</Label>
                      <Input
                        id="topup-amount"
                        type="number"
                        placeholder="Enter amount (₹10 – ₹500)"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        min="10"
                        max="500"
                        disabled={isTopUpProcessing}
                      />
                      <p className="text-xs text-muted-foreground">Minimum: ₹10 • Maximum: ₹500</p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-3">
                      <p className="text-sm text-indigo-900 dark:text-indigo-200 font-semibold">Secure Payment</p>
                      <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">Pay via UPI, card or net banking. Amount is credited instantly after payment.</p>
                    </div>
                    <Button
                      className="w-full"
                      disabled={isTopUpProcessing || !topUpAmount || parseFloat(topUpAmount) < 10 || parseFloat(topUpAmount) > 500}
                      onClick={async () => {
                        const amt = parseFloat(topUpAmount);
                        if (!amt || amt < 10 || amt > 500) return;
                        setIsTopUpProcessing(true);
                        try {
                          await onTopUp(amt);
                          setIsTopUpDialogOpen(false);
                          setTopUpAmount("");
                        } catch (error: any) {
                          if (error?.message !== 'PAYMENT_CANCELLED') {
                            toast.error(formatClientErrorMessage(error, "Payment failed. Please try again."));
                          }
                          // if cancelled, keep dialog open so user can retry
                        } finally {
                          setIsTopUpProcessing(false);
                        }
                      }}
                    >
                      {isTopUpProcessing ? "Opening payment..." : `Pay ₹${parseFloat(topUpAmount) > 0 ? parseFloat(topUpAmount).toFixed(2) : "0.00"} via UPI`}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add money to your wallet to purchase notes from the marketplace.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Withdraw Funds</CardTitle>
            <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={effectiveAvailableBalance <= 0}>
                  <IndianRupee className="w-4 h-4 mr-2" />
                  Withdraw
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Withdraw to UPI / Bank</DialogTitle>
                  <DialogDescription>
                    Available Balance: ₹{effectiveAvailableBalance.toFixed(2)}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Withdrawal Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      min="100"
                      max={isAdmin ? "1000" : "500"}
                      disabled={isProcessing}
                      className={
                        withdrawAmount && amount > 0 && amount < 100
                          ? "border-red-500 focus-visible:ring-red-500"
                          : withdrawAmount && (amount > effectiveAvailableBalance || amount > (isAdmin ? 1000 : 500))
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      }
                    />
                    {withdrawAmount && amount > 0 && amount < 100 && (
                      <p className="text-xs text-red-600">
                        ⚠ Amount must be at least ₹100
                      </p>
                    )}
                    {withdrawAmount && amount > (isAdmin ? 1000 : 500) && (
                      <p className="text-xs text-red-600">
                        ⚠ Maximum withdrawal amount is ₹{isAdmin ? "1000" : "500"}
                      </p>
                    )}
                    {withdrawAmount && amount > effectiveAvailableBalance && amount <= (isAdmin ? 1000 : 500) && (
                      <p className="text-xs text-red-600">
                        ⚠ Amount exceeds available balance
                      </p>
                    )}
                    {(!withdrawAmount || (amount >= 100 && amount <= Math.min(effectiveAvailableBalance, isAdmin ? 1000 : 500))) && (
                      <p className="text-xs text-muted-foreground">
                        Minimum: ₹100 • Maximum: ₹{isAdmin ? "1000" : "500"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upi">UPI ID</Label>
                    <Input
                      id="upi"
                      placeholder="yourname@upi"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      disabled={isProcessing}
                    />
                    <p className="text-xs text-muted-foreground">
                      Or provide bank account details for bank transfer
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-3">
                    <p className="text-sm text-blue-900 dark:text-blue-200 font-semibold">
                      Manual Withdrawal by NotesMitra Team
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      Your request will be reviewed and funds sent to your UPI within 1–2 business days.
                    </p>
                  </div>

                  <Button 
                    onClick={handleWithdraw} 
                    className="w-full"
                    disabled={isProcessing || !isValidAmount || !upiId.trim()}
                  >
                    {isProcessing ? "Processing..." : "Confirm Withdrawal"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Withdraw your earnings to UPI or bank account. Minimum withdrawal: ₹100
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle>Transaction History</CardTitle>
              <div className="flex items-center gap-1">
                {onRefresh && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    title="Refresh transactions"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                )}
                {(txnSearch || dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-7 px-2"
                    onClick={() => { setTxnSearch(""); setDateFrom(""); setDateTo(""); }}
                  >
                    <X className="w-3 h-3 mr-1" /> Clear filters
                  </Button>
                )}
              </div>
            </div>
            {/* Filters row */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by description, amount…"
                  value={txnSearch}
                  onChange={e => setTxnSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  type="date"
                  title="From date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="h-8 text-sm flex-1 min-w-[130px]"
                />
                <span className="text-muted-foreground text-xs">–</span>
                <Input
                  type="date"
                  title="To date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="h-8 text-sm flex-1 min-w-[130px]"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const q = txnSearch.trim().toLowerCase();
            const from = dateFrom ? new Date(dateFrom).setHours(0,0,0,0) : null;
            const to = dateTo ? new Date(dateTo).setHours(23,59,59,999) : null;
            const hasFilter = q || from || to;

            const filtered = hasFilter
              ? displayTransactions.filter(t => {
                  const ts = new Date(t.date).getTime();
                  if (from && ts < from) return false;
                  if (to && ts > to) return false;
                  if (q && !t.description.toLowerCase().includes(q) &&
                           !t.amount.toString().includes(q) &&
                           !t.status.toLowerCase().includes(q)) return false;
                  return true;
                })
              : displayTransactions.slice(0, TXN_PAGE_SIZE);

            const noFilterMsg = q || dateFrom || dateTo
              ? `No transactions matching the current filters`
              : "No transactions yet";

            return (
              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{noFilterMsg}</p>
                ) : (
                  <>
                    {filtered.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`p-2 rounded-xl shrink-0 ${
                            transaction.type === "credit"
                              ? "bg-emerald-100 dark:bg-emerald-900/30"
                              : "bg-violet-100 dark:bg-violet-900/30"
                          }`}>
                            {transaction.type === "credit" ? (
                              <ArrowDownRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm break-words leading-snug">{transaction.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(transaction.date).toLocaleDateString()} • {new Date(transaction.date).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-semibold ${
                            transaction.type === "credit"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-violet-600 dark:text-violet-400"
                          }`}>
                            {transaction.type === "credit" ? "+" : "-"}₹{transaction.amount.toFixed(2)}
                          </p>
                          <Badge
                            variant={transaction.status === "completed" ? "default" : "outline"}
                            className="text-xs mt-1"
                          >
                            {transaction.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                            {transaction.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {!hasFilter && displayTransactions.length > TXN_PAGE_SIZE && (
                      <p className="text-xs text-center text-muted-foreground pt-1">
                        Showing {TXN_PAGE_SIZE} of {displayTransactions.length} — use search or date filter to find older ones
                      </p>
                    )}
                    {hasFilter && (
                      <p className="text-xs text-center text-muted-foreground pt-1">
                        {filtered.length} result{filtered.length !== 1 ? "s" : ""} found
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
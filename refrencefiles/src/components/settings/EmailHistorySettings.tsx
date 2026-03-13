import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useProfiles, getDisplayName } from "@/hooks/useProfiles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mail, Search, Eye, Clock, Filter, RefreshCw, ChevronLeft, ChevronRight, RotateCcw, Loader2, Download, Calendar, AlertTriangle, XCircle, CheckCircle2, Send, Ban, MailX, ChevronDown, Info, Reply } from "lucide-react";
import { format } from "date-fns";
import { EmailReplyModal } from "@/components/email/EmailReplyModal";
import { OutlookEmailBody } from "@/components/email/OutlookEmailBody";
import { getAvatarColor, getInitials, getBounceExplanation, cleanBounceReason, stripHtmlTags } from "@/utils/emailUtils";

interface EmailHistoryRecord {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string | null;
  sender_email: string;
  sent_at: string;
  status: string;
  open_count: number | null;
  unique_opens: number | null;
  is_valid_open: boolean | null;
  opened_at: string | null;
  clicked_at: string | null;
  contact_id: string | null;
  lead_id: string | null;
  account_id: string | null;
  bounce_type: string | null;
  bounce_reason: string | null;
  bounced_at: string | null;
  reply_count: number | null;
  replied_at: string | null;
  last_reply_at: string | null;
  sent_by: string | null;
}

interface EmailReply {
  id: string;
  from_email: string;
  from_name: string | null;
  received_at: string;
  body_preview: string | null;
  subject: string | null;
}

const ITEMS_PER_PAGE = 10;

// Use shared utilities from emailUtils (getBounceExplanation, cleanBounceReason)

const EmailHistorySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [emails, setEmails] = useState<EmailHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEmail, setSelectedEmail] = useState<EmailHistoryRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [retryingEmailId, setRetryingEmailId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>("all");
  const [isSyncingBounces, setIsSyncingBounces] = useState(false);
  const [isSyncingReplies, setIsSyncingReplies] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [replies, setReplies] = useState<EmailReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [expandedReplyId, setExpandedReplyId] = useState<string | null>(null);
  
  // Reply modal state
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyToData, setReplyToData] = useState<{ from_email: string; from_name: string | null; body_preview?: string | null; received_at?: string; subject?: string | null } | undefined>(undefined);

  // Use shared profiles hook for sender name resolution
  const { data: profiles = [] } = useProfiles();

  // Get sender display name using sent_by field
  const getSenderDisplayName = (email: EmailHistoryRecord) => {
    if (email.sent_by) {
      return getDisplayName(profiles, email.sent_by);
    }
    return email.sender_email.split('@')[0];
  };

  useEffect(() => {
    fetchEmailHistory();
  }, [user]);

  // Real-time subscription for bounce detection
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('email-bounce-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_history',
        },
        (payload) => {
          const newRecord = payload.new as EmailHistoryRecord;
          const oldRecord = payload.old as Partial<EmailHistoryRecord>;
          
          // Check if status changed to bounced
          if (newRecord.status === 'bounced' && oldRecord.status !== 'bounced') {
            toast({
              title: "Bounce Detected",
              description: `Email to ${newRecord.recipient_email} has bounced.`,
              variant: "destructive",
            });
            
            // Refresh the list to show updated status
            fetchEmailHistory();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, dateRange, statusFilter]);

  // Fetch replies when an email is selected
  useEffect(() => {
    if (selectedEmail && (selectedEmail.reply_count || 0) > 0) {
      setLoadingReplies(true);
      supabase
        .from('email_replies')
        .select('id, from_email, from_name, received_at, body_preview, subject')
        .eq('email_history_id', selectedEmail.id)
        .order('received_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching replies:', error);
            setReplies([]);
          } else {
            setReplies((data as EmailReply[]) || []);
          }
          setLoadingReplies(false);
        });
    } else {
      setReplies([]);
    }
  }, [selectedEmail]);

  const fetchEmailHistory = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_history')
        .select('id, recipient_email, recipient_name, sender_email, subject, body, status, sent_at, sent_by, delivered_at, opened_at, open_count, unique_opens, is_valid_open, click_count, clicked_at, contact_id, lead_id, account_id, bounce_type, bounce_reason, bounced_at, reply_count, replied_at, last_reply_at')
        .eq('sent_by', user.id)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error('Error fetching email history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncBounces = async () => {
    setIsSyncingBounces(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Use the improved process-bounce-checks function
      const { data, error } = await supabase.functions.invoke('process-bounce-checks', {
        body: {},
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data.hint && data.totalBouncesFound === 0) {
        toast({
          title: "Bounce Check Complete",
          description: data.hint,
          variant: "default",
        });
      } else {
        toast({
          title: "Bounce Check Complete",
          description: data.message || `Found ${data.totalBouncesFound || 0} bounced email(s)`,
        });
      }

      // Refresh the list
      fetchEmailHistory();
    } catch (error: any) {
      console.error('Error syncing bounces:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to check bounces. Ensure Azure app has 'Mail.Read' application permission.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingBounces(false);
    }
  };

  const handleSyncReplies = async () => {
    setIsSyncingReplies(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('process-email-replies', {
        body: {},
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Reply Sync Complete",
        description: data.message || `Found ${data.repliesFound || 0} new reply(s)`,
      });

      // Refresh the list
      fetchEmailHistory();
    } catch (error: any) {
      console.error('Error syncing replies:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to check replies. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingReplies(false);
    }
  };

  const handleRetryEmail = async (email: EmailHistoryRecord, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    setRetryingEmailId(email.id);
    try {
      // Determine entity type and id for proper association
      let entityType: string | undefined;
      let entityId: string | undefined;
      
      if (email.contact_id) {
        entityType = 'contact';
        entityId = email.contact_id;
      } else if (email.lead_id) {
        entityType = 'lead';
        entityId = email.lead_id;
      } else if (email.account_id) {
        entityType = 'account';
        entityId = email.account_id;
      }
      
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email.recipient_email,
          toName: email.recipient_name,
          from: email.sender_email,
          subject: email.subject,
          body: email.body,
          entityType,
          entityId,
        }
      });

      if (error) throw error;

      toast({
        title: "Email Sent",
        description: `Email to ${email.recipient_email} has been resent successfully.`,
      });

      // Refresh the list
      fetchEmailHistory();
    } catch (error: any) {
      console.error('Error retrying email:', error);
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to resend email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRetryingEmailId(null);
    }
  };

  // Handle reply to original email
  const handleReplyToEmail = (email: EmailHistoryRecord) => {
    setSelectedEmail(email);
    setReplyToData(undefined);
    setShowReplyModal(true);
  };

  // Handle reply to a specific reply in the thread
  const handleReplyToReply = (reply: EmailReply) => {
    setReplyToData({
      from_email: reply.from_email,
      from_name: reply.from_name,
      body_preview: reply.body_preview,
      received_at: reply.received_at,
      subject: reply.subject,
    });
    setShowReplyModal(true);
  };

  const getEntityType = (email: EmailHistoryRecord): string => {
    if (email.contact_id) return "Contact";
    if (email.lead_id) return "Lead";
    if (email.account_id) return "Account";
    return "Other";
  };

  const getEntityBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
    switch (type) {
      case "Contact": return "default";
      case "Lead": return "secondary";
      case "Account": return "outline";
      default: return "outline";
    }
  };

  const getStatusBadge = (email: EmailHistoryRecord) => {
    const status = email.status;
    const bounceType = email.bounce_type;
    const isValidOpen = email.is_valid_open;
    const replyCount = email.reply_count;

    // Show "Verifying..." for emails sent within the last 120 seconds
    const sentAt = new Date(email.sent_at);
    const isRecentlySent = Date.now() - sentAt.getTime() < 120000; // 120 seconds

    if (status === 'sent' && isRecentlySent && !bounceType) {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Verifying...
        </Badge>
      );
    }

    // Bounced takes priority - use user-friendly messaging
    if (bounceType || status === 'bounced') {
      const bounceInfo = getBounceExplanation(bounceType, email.bounce_reason);
      const cleanedReason = cleanBounceReason(email.bounce_reason);
      
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {bounceInfo.title}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">
              <p className="font-medium">{bounceInfo.title}</p>
              <p className="text-xs text-muted-foreground">{bounceInfo.subtitle}</p>
              {cleanedReason.summary && (
                <p className="text-xs mt-1">{cleanedReason.summary}</p>
              )}
              {email.bounced_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(email.bounced_at), 'PPp')}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Show replied status if there are replies
    if (status === 'replied' || (replyCount && replyCount > 0)) {
      return (
        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 flex items-center gap-1">
          <Reply className="w-3 h-3" />
          Replied {replyCount && replyCount > 1 ? `(${replyCount})` : ''}
        </Badge>
      );
    }

    // Suspicious open
    if (status === 'opened' && isValidOpen === false) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-yellow-600 border-yellow-400 bg-yellow-50 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Suspicious
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>This open may be from an email scanner or bot</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    const statusColors: Record<string, { bg: string; icon: React.ReactNode }> = {
      sent: { bg: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: <Send className="w-3 h-3" /> },
      delivered: { bg: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle2 className="w-3 h-3" /> },
      opened: { bg: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: <Eye className="w-3 h-3" /> },
      failed: { bg: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle className="w-3 h-3" /> },
    };

    const config = statusColors[status] || statusColors.sent;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${config.bg}`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getOpensDisplay = (email: EmailHistoryRecord) => {
    // Bounced emails should show 0 opens
    if (email.bounce_type || email.status === 'bounced') {
      return <span className="text-muted-foreground">0</span>;
    }

    const uniqueOpens = email.unique_opens || 0;
    const totalOpens = email.open_count || 0;
    const isValidOpen = email.is_valid_open;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="flex items-center gap-1">
            <Eye className={`w-4 h-4 ${isValidOpen === false ? 'text-yellow-500' : ''}`} />
            <span className={isValidOpen === false ? 'text-yellow-600' : (uniqueOpens > 0 ? 'text-primary font-medium' : 'text-muted-foreground')}>
              {uniqueOpens}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Unique opens: {uniqueOpens}</p>
            <p>Total opens: {totalOpens}</p>
            {isValidOpen === false && <p className="text-yellow-500">May include scanner/bot opens</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = 
      email.recipient_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.recipient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Date range filter
    let matchesDate = true;
    if (dateRange !== "all") {
      const emailDate = new Date(email.sent_at);
      const now = new Date();
      const days = parseInt(dateRange);
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      matchesDate = emailDate >= cutoffDate;
    }
    
    let matchesType = true;
    if (filterType === "contact") matchesType = !!email.contact_id;
    else if (filterType === "lead") matchesType = !!email.lead_id;
    else if (filterType === "account") matchesType = !!email.account_id;

    // Status filter
    let matchesStatus = true;
    if (statusFilter !== "all") {
      if (statusFilter === "bounced") {
        matchesStatus = !!email.bounce_type || email.status === 'bounced';
      } else if (statusFilter === "replied") {
        matchesStatus = email.status === 'replied' || (email.reply_count || 0) > 0;
      } else {
        matchesStatus = email.status === statusFilter;
      }
    }
    
    return matchesSearch && matchesDate && matchesType && matchesStatus;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredEmails.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedEmails = filteredEmails.slice(startIndex, endIndex);

  // Calculate stats excluding bounced emails for open rate
  const nonBouncedEmails = emails.filter(e => !e.bounce_type && e.status !== 'bounced');
  const validOpens = nonBouncedEmails.filter(e => (e.unique_opens || e.open_count || 0) > 0 && e.is_valid_open !== false);
  const repliedEmails = emails.filter(e => e.status === 'replied' || (e.reply_count || 0) > 0);
  const stats = {
    total: emails.length,
    bounced: emails.filter(e => e.bounce_type || e.status === 'bounced').length,
    opened: validOpens.length,
    replied: repliedEmails.length,
    openRate: nonBouncedEmails.length > 0 ? Math.round((validOpens.length / nonBouncedEmails.length) * 100) : 0,
  };

  const handleExportCSV = () => {
    const headers = ["Recipient Name", "Recipient Email", "Subject", "Sent At", "Status", "Unique Opens", "Total Opens", "Valid Open", "Replies", "Bounce Type", "Bounce Reason", "Type"];
    const rows = filteredEmails.map(email => [
      email.recipient_name || "Unknown",
      email.recipient_email,
      email.subject,
      format(new Date(email.sent_at), "yyyy-MM-dd HH:mm"),
      email.status,
      email.unique_opens || 0,
      email.open_count || 0,
      email.is_valid_open !== false ? "Yes" : "No",
      email.reply_count || 0,
      email.bounce_type || "",
      email.bounce_reason || "",
      getEntityType(email)
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `email_history_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  // Check if email can be replied to
  const canReplyToEmail = (email: EmailHistoryRecord) => {
    return !email.bounce_type && email.status !== 'failed' && email.status !== 'bounced';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Email History</h2>
        <p className="text-sm text-muted-foreground">
          View all emails you've sent to contacts, leads, and accounts with tracking details.
        </p>
      </div>

      {/* Stats Cards - Clickable to filter */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${statusFilter === 'all' ? 'border-primary ring-1 ring-primary' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Sent</span>
            </div>
            <p className="text-xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:border-destructive/50 ${statusFilter === 'bounced' ? 'border-destructive ring-1 ring-destructive' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'bounced' ? 'all' : 'bounced')}
        >
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-muted-foreground">Bounced</span>
            </div>
            <p className="text-xl font-bold mt-1 text-destructive">{stats.bounced}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:border-green-500/50 ${statusFilter === 'opened' ? 'border-green-500 ring-1 ring-green-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'opened' ? 'all' : 'opened')}
        >
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Opened</span>
            </div>
            <p className="text-xl font-bold mt-1">{stats.opened}</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:border-purple-500/50 ${statusFilter === 'replied' ? 'border-purple-500 ring-1 ring-purple-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'replied' ? 'all' : 'replied')}
        >
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <Reply className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Replied</span>
            </div>
            <p className="text-xl font-bold mt-1 text-purple-600">{stats.replied}</p>
          </CardContent>
        </Card>
        <Card className="cursor-default">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Open Rate</span>
            </div>
            <p className="text-xl font-bold mt-1">{stats.openRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by recipient, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Emails</SelectItem>
            <SelectItem value="contact">Contacts</SelectItem>
            <SelectItem value="lead">Leads</SelectItem>
            <SelectItem value="account">Accounts</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="opened">Opened</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchEmailHistory} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleSyncBounces} disabled={isSyncingBounces}>
                  <Ban className={`h-4 w-4 mr-2 ${isSyncingBounces ? 'animate-pulse' : ''}`} />
                  {isSyncingBounces ? 'Syncing...' : 'Sync Bounces'}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[300px]">
                <p className="font-medium">Bounce Detection</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Checks Office 365 mailbox for bounce-back emails (NDRs).
                </p>
                <p className="text-xs text-orange-500 mt-1 font-medium">
                  ⚠️ Requires Azure AD app to have "Mail.Read" APPLICATION permission with admin consent.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleSyncReplies} disabled={isSyncingReplies}>
                  <Reply className={`h-4 w-4 mr-2 ${isSyncingReplies ? 'animate-pulse' : ''}`} />
                  {isSyncingReplies ? 'Syncing...' : 'Sync Replies'}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[300px]">
                <p className="font-medium">Reply Detection</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Checks inbox for replies to sent emails within the last 30 days.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Only works for emails where the Message-ID was successfully captured.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" onClick={handleExportCSV} disabled={filteredEmails.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Email Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sent Emails</CardTitle>
          <CardDescription>
            {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''} found
            {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No emails found</p>
              <p className="text-sm">Emails you send will appear here</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Opens</TableHead>
                      <TableHead className="text-center">Replies</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmails.map((email) => {
                      const entityType = getEntityType(email);
                      return (
                        <TableRow 
                          key={email.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{email.recipient_name || "Unknown"} ({email.recipient_email})</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="max-w-[200px] truncate">{email.subject}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getEntityBadgeVariant(entityType)}>
                              {entityType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(email.sent_at), "MMM d, yyyy HH:mm")}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(email)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getOpensDisplay(email)}
                          </TableCell>
                          <TableCell className="text-center">
                            {email.reply_count && email.reply_count > 0 ? (
                              <Badge variant="secondary" className="text-xs">
                                <Reply className="w-3 h-3 mr-1" />
                                {email.reply_count}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(email.status === 'failed' || email.bounce_type) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => handleRetryEmail(email, e)}
                                      disabled={retryingEmailId === email.id}
                                    >
                                      {retryingEmailId === email.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <RotateCcw className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Retry sending</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredEmails.length)} of {filteredEmails.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => { setSelectedEmail(null); setShowTechnicalDetails(false); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
            <DialogDescription>
              Sent on {selectedEmail && format(new Date(selectedEmail.sent_at), "MMMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              {/* Standardized Layout: From -> To -> Subject */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</p>
                    <p className="font-medium mt-1">{getSenderDisplayName(selectedEmail)} ({selectedEmail.sender_email})</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</p>
                    <p className="font-medium mt-1">{selectedEmail.recipient_name || selectedEmail.recipient_email.split('@')[0]} ({selectedEmail.recipient_email})</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</p>
                  <p className="font-medium mt-1">{selectedEmail.subject}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedEmail)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Opens</p>
                  <p className="font-medium">{getOpensDisplay(selectedEmail)}</p>
                </div>
                {selectedEmail.opened_at && !selectedEmail.bounce_type && (
                  <div>
                    <p className="text-sm text-muted-foreground">First Opened</p>
                    <p className="text-sm">{format(new Date(selectedEmail.opened_at), "MMM d, yyyy HH:mm")}</p>
                  </div>
                )}
              </div>

              {/* User-friendly bounce info */}
              {selectedEmail.bounce_type && (() => {
                const bounceInfo = getBounceExplanation(selectedEmail.bounce_type, selectedEmail.bounce_reason);
                const cleanedReason = cleanBounceReason(selectedEmail.bounce_reason);
                // Get icon based on bounce type
                const BounceIcon = selectedEmail.bounce_type === 'hard' ? MailX : selectedEmail.bounce_type === 'soft' ? AlertTriangle : XCircle;
                
                return (
                  <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <div className="flex items-start gap-3">
                      <BounceIcon className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-destructive">{bounceInfo.title}</p>
                        <p className="text-sm text-muted-foreground">{bounceInfo.subtitle}</p>
                        
                        <p className="text-sm mt-2">{bounceInfo.description}</p>
                        
                        {cleanedReason.summary && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                            <div className="flex items-start gap-2">
                              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <span>{cleanedReason.summary}</span>
                            </div>
                          </div>
                        )}
                        
                        {selectedEmail.bounced_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Failed on {format(new Date(selectedEmail.bounced_at), 'MMMM d, yyyy \'at\' h:mm a')}
                          </p>
                        )}
                        
                        {cleanedReason.technical && (
                          <Collapsible open={showTechnicalDetails} onOpenChange={setShowTechnicalDetails} className="mt-3">
                            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                              <ChevronDown className={`h-3 w-3 transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
                              {showTechnicalDetails ? 'Hide' : 'View'} technical details
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap break-words font-mono">
                                {cleanedReason.technical}
                              </pre>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Replies Section - Outlook-style formatting */}
              {(selectedEmail.reply_count || 0) > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Reply className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">Replies ({selectedEmail.reply_count})</span>
                  </div>
                  {loadingReplies ? (
                    <div className="space-y-2">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : replies.length > 0 ? (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto">
                      {replies.map(reply => {
                        // Parse reply body to separate actual reply from quoted content
                        const parseEmailReply = (bodyPreview: string) => {
                          const separators = [
                            /_{10,}/,  // Underscore separator (Outlook)
                            /^-{3,}\s*Original Message\s*-{3,}/mi,
                            /^On .+ wrote:$/m,
                            /^From:.+\nSent:.+\nTo:.+/m,
                          ];
                          
                          let replyBody = bodyPreview;
                          let quotedContent = '';
                          
                          for (const sep of separators) {
                            const match = bodyPreview.match(sep);
                            if (match && match.index !== undefined) {
                              replyBody = bodyPreview.substring(0, match.index).trim();
                              quotedContent = bodyPreview.substring(match.index).trim();
                              break;
                            }
                          }
                          
                          return { replyBody, quotedContent };
                        };
                        
                        const { replyBody, quotedContent } = parseEmailReply(reply.body_preview || '');
                        const initials = (reply.from_name || reply.from_email.split('@')[0])
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .toUpperCase()
                          .substring(0, 2);
                        
                        // Generate consistent color based on email
                        const getAvatarColor = (email: string) => {
                          const colors = ['bg-red-600', 'bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-orange-600', 'bg-teal-600'];
                          const hash = email.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                          return colors[hash % colors.length];
                        };
                        
                        const isExpanded = expandedReplyId === reply.id;
                        
                        return (
                          <div key={reply.id} className="rounded-lg border overflow-hidden shadow-sm">
                            {/* Subject Header - Dark background like Outlook */}
                            <div className="bg-slate-700 dark:bg-slate-800 px-4 py-2">
                              <span className="text-white text-sm font-medium">
                                {reply.subject || 'No Subject'}
                              </span>
                            </div>
                            
                            {/* Email Content */}
                            <div className="p-4 bg-background">
                              {/* Sender Row with email in brackets */}
                              <div className="flex items-start gap-3 mb-3">
                                {/* Avatar/Initials */}
                                <div className={`w-9 h-9 rounded-full ${getAvatarColor(reply.from_email)} flex items-center justify-center flex-shrink-0`}>
                                  <span className="text-white text-xs font-semibold">{initials}</span>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  {/* Sender name with email */}
                                  <div className="font-medium text-sm">
                                    {reply.from_name || reply.from_email} ({reply.from_email})
                                  </div>
                                  
                                  {/* To line - Fixed: show sender_email (original sender who receives the reply) */}
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <span>To:</span>
                                    <span>{selectedEmail.sender_email}</span>
                                  </div>
                                </div>
                                
                                {/* Timestamp */}
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(reply.received_at), 'MMM d, yyyy HH:mm')}
                                </span>
                              </div>
                              
                              {/* Reply Body */}
                              <div className="text-sm whitespace-pre-line pl-12">
                                {replyBody || 'No content'}
                              </div>
                              
                              {/* Quoted Content - Collapsible */}
                              {quotedContent && (
                                <Collapsible 
                                  open={isExpanded} 
                                  onOpenChange={() => setExpandedReplyId(isExpanded ? null : reply.id)}
                                  className="mt-3 pl-12"
                                >
                                  <CollapsibleTrigger className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                    <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    {isExpanded ? 'Hide' : 'Show'} quoted text
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="mt-2 text-xs text-muted-foreground border-l-2 border-muted pl-3 whitespace-pre-line">
                                      {quotedContent}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {/* Reply to this reply button */}
                              <div className="mt-3 pl-12">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReplyToReply(reply);
                                  }}
                                  className="gap-1 h-7 text-xs"
                                >
                                  <Reply className="h-3 w-3" />
                                  Reply
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Replies detected but details not available yet.</p>
                  )}
                </div>
              )}

              {/* Suspicious open warning */}
              {selectedEmail.status === 'opened' && selectedEmail.is_valid_open === false && !selectedEmail.bounce_type && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Suspicious Open Detected</span>
                  </div>
                  <p className="text-sm mt-1 text-muted-foreground">
                    This open may be from an email security scanner or bot, not the actual recipient.
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Content</p>
                <div 
                  className="p-4 bg-muted/50 rounded-lg prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body || '' }}
                />
              </div>

              {/* Actions - retry for failed/bounced, reply for delivered */}
              <div className="flex gap-2 pt-4 border-t">
                {(selectedEmail.status === 'failed' || selectedEmail.bounce_type) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetryEmail(selectedEmail)}
                    disabled={retryingEmailId === selectedEmail.id}
                  >
                    {retryingEmailId === selectedEmail.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    Retry Sending
                  </Button>
                )}
                
                {/* Reply button for successfully delivered emails */}
                {canReplyToEmail(selectedEmail) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReplyToEmail(selectedEmail)}
                  >
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reply Modal */}
      {selectedEmail && (
        <EmailReplyModal
          open={showReplyModal}
          onOpenChange={setShowReplyModal}
          originalEmail={{
            id: selectedEmail.id,
            recipient_email: selectedEmail.recipient_email,
            recipient_name: selectedEmail.recipient_name,
            sender_email: selectedEmail.sender_email,
            subject: selectedEmail.subject,
            body: selectedEmail.body,
            sent_at: selectedEmail.sent_at,
            contact_id: selectedEmail.contact_id,
            lead_id: selectedEmail.lead_id,
            account_id: selectedEmail.account_id,
          }}
          replyTo={replyToData}
          onReplySent={() => {
            fetchEmailHistory();
            setShowReplyModal(false);
          }}
        />
      )}
    </div>
  );
};

export default EmailHistorySettings;

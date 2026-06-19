"use client";

import Image from "next/image";
import Link from "next/link";
import { formatNumber } from "@/utils";
import { isProviderId } from "@/lib/providers/types";
import { ProtocolBadge } from "./ProtocolBadge";

export interface Activity {
  id: string;
  type: "send" | "request" | "send_claim";
  status: "open" | "processing" | "settled" | "cancelled";
  amount: number;
  token_address: string | null;
  message: string | null;
  created_at: string;
  sender_address: string | null;
  receiver_address: string | null;
  provider_id: string | null;
}

export interface Stats {
  sent_direct: number;
  sent_claim: number;
  total_sent: number;
  total_received: number;
  total_requested: number;
  total_claimed: number;
}

const STATUS_COLORS: Record<Activity["status"], string> = {
  open: "#CB9C00",
  processing: "#CB9C00",
  settled: "#008834",
  cancelled: "#CB0000",
};

export function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays <= 7) return `${diffDays}d ago`;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

const getActivityLabel = (activity: Activity, walletAddress?: string | null) => {
  const isSender =
    activity.sender_address?.toLowerCase() === walletAddress?.toLowerCase();
  switch (activity.type) {
    case "send":
      return isSender
        ? `Sent ${formatNumber(activity.amount)} USDC`
        : `Received ${formatNumber(activity.amount)} USDC`;
    case "send_claim":
      return isSender
        ? `Sent ${formatNumber(activity.amount)} USDC via Claim`
        : `Claimed ${formatNumber(activity.amount)} USDC`;
    case "request":
      if (
        activity.receiver_address?.toLowerCase() === walletAddress?.toLowerCase()
      ) {
        return `Requested ${formatNumber(activity.amount)} USDC`;
      }
      return `Fulfilled ${formatNumber(activity.amount)} USDC`;
    default:
      return `${formatNumber(activity.amount)} USDC`;
  }
};

const getActivityIcon = (activity: Activity, walletAddress?: string | null) => {
  const isSender =
    activity.sender_address?.toLowerCase() === walletAddress?.toLowerCase();
  if (activity.type === "send" || activity.type === "send_claim") {
    return isSender ? "/assets/send.svg" : "/assets/receive.svg";
  }
  if (activity.type === "request") {
    if (activity.receiver_address?.toLowerCase() === walletAddress?.toLowerCase()) {
      return "/assets/receive.svg";
    }
    return "/assets/send.svg";
  }
  return "/assets/send.svg";
};

const getActivityLink = (activity: Activity): string | null => {
  if (activity.status !== "open") return null;
  if (activity.type === "request") return `/r/${activity.id}`;
  if (activity.type === "send_claim") return `/c/${activity.id}`;
  return null;
};

export function ActivityItem({
  activity,
  walletAddress,
}: {
  activity: Activity;
  walletAddress?: string | null;
}) {
  const link = getActivityLink(activity);
  const content = (
    <>
      <Image
        src={getActivityIcon(activity, walletAddress)}
        alt=""
        width={20}
        height={20}
        className="mt-0.5 invert"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[#121212] text-sm">
            {getActivityLabel(activity, walletAddress)}
          </p>
          {activity.provider_id && isProviderId(activity.provider_id) && (
            <ProtocolBadge
              providerId={activity.provider_id}
              iconSize={12}
              showLabel={false}
            />
          )}
        </div>
        <p
          className="text-xs font-normal uppercase"
          style={{ color: STATUS_COLORS[activity.status] }}
        >
          {activity.status}
        </p>
      </div>
      <span className="text-[#121212]/50 text-xs whitespace-nowrap">
        {formatTimeAgo(activity.created_at)}
      </span>
    </>
  );

  if (link) {
    return (
      <Link
        href={link}
        className="flex items-start gap-3 hover:bg-[#121212]/5 -mx-2 px-2 py-1 rounded-lg transition-colors"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex items-start gap-3 py-1">{content}</div>;
}

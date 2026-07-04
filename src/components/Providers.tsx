"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig
        value={{
          fetcher,
          // Show cached data instantly, revalidate in the background.
          keepPreviousData: true,
          revalidateOnFocus: true,
          dedupingInterval: 1500,
          focusThrottleInterval: 4000,
        }}
      >
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}

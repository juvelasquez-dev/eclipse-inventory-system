import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase";

export type UserAreaCode = "IAO" | "CBR" | "EFT" | null;

export function useUserArea() {
  const [areaCode, setAreaCode] =
    useState<UserAreaCode>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadArea() {
      const { data, error } = await supabase.rpc(
        "get_current_user_area_code"
      );

      if (!isMounted) return;

      if (error) {
        console.error("Unable to load user area:", error);
        setAreaCode(null);
      } else {
        setAreaCode(
          data === "IAO" || data === "CBR" || data === "EFT"
            ? data
            : null
        );
      }

      setLoading(false);
    }

    void loadArea();

    return () => {
      isMounted = false;
    };
  }, []);

  return { areaCode, loading };
}

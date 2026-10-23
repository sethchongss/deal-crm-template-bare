export { createClient } from "@/lib/supabase/client";

import { createClient } from "@/lib/supabase/client";

/** Browser client. Session cookies are shared with the server proxy. */
export const supabase = createClient();

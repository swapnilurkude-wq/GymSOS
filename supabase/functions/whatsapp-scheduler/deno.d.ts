declare module "jsr:@supabase/supabase-js@2" {
  export function createClient(...args: any[]): any
}

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get(key: string): string | undefined
  }
}

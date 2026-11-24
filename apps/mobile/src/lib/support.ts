import { z } from 'zod';

import { rpc } from './api';

// Appeals and support requests (FT-046). Members cannot write these tables; the two database
// functions are the only way in, and both are safe to repeat (an open one is returned).

export const MESSAGE_MAX = 1000; // the database refuses longer text

export type SupportType = 'deletion_query' | 'other';

// 'support' means there was nothing to appeal, so support got the message instead (error R08).
export const submitAppeal = (message: string) =>
  rpc(
    'submit_appeal',
    { p_message: message },
    { schema: z.enum(['appeal', 'support']), kind: 'write' },
  );

export const requestSupport = (type: SupportType, details: string) =>
  rpc(
    'request_support',
    { p_type: type, p_details: details },
    { schema: z.string(), kind: 'write' },
  );

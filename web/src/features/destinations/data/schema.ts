import { z } from 'zod'

export const destinationSchema = z.object({
    id: z.number(),
    name: z.string(),
    type: z.string(),
    config: z.record(z.string(), z.any()), // JSONB config
    created_at: z.string(),
    updated_at: z.string(),
    is_used_in_active_pipeline: z.boolean().optional(),
})

export type Destination = z.infer<typeof destinationSchema>

export const destinationFormSchema = z.object({
    name: z.string().min(1, 'Name is required').regex(/^[a-zA-Z0-9_]+$/, 'Name must contain only alphanumeric characters and underscores'),
    type: z.string().min(1, 'Type is required'),
    config: z.object({
        account: z.string().optional(),
        user: z.string().optional(),
        database: z.string().optional(),
        schema: z.string().optional(),
        landing_database: z.string().optional(),
        landing_schema: z.string().optional(),
        role: z.string().optional(),
        private_key: z.string().optional(),
        private_key_passphrase: z.string().optional(),
        warehouse: z.string().optional(),
        // Postgres
        host: z.string().optional(),
        port: z.number().optional(),
        password: z.string().optional(),
    }).optional(),
})

export type DestinationForm = z.infer<typeof destinationFormSchema>

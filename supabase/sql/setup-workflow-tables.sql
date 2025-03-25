-- Check if tables exist and create them if they don't
DO $$
BEGIN
    -- Create email_workflows table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'email_workflows') THEN
        CREATE TABLE public.email_workflows (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            agent_id UUID NOT NULL,
            name VARCHAR(255) NOT NULL,
            trigger_event VARCHAR(100) DEFAULT 'email_received',
            email_template TEXT,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            email_filter JSONB DEFAULT '{}'::jsonb,
            actions JSONB DEFAULT '{}'::jsonb
        );
        
        -- Add constraint if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_workflows_agent_id_fkey') THEN
            ALTER TABLE public.email_workflows 
            ADD CONSTRAINT email_workflows_agent_id_fkey 
            FOREIGN KEY (agent_id) 
            REFERENCES public.profiles(id) 
            ON DELETE CASCADE;
        END IF;
    END IF;

    -- Create workflow_logs table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_logs') THEN
        CREATE TABLE public.workflow_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            workflow_id UUID NOT NULL,
            tenant_id UUID,
            application_id UUID,
            triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            status VARCHAR(50) NOT NULL,
            error_message TEXT,
            email_subject TEXT,
            email_from VARCHAR(255),
            action_taken TEXT
        );
        
        -- Add constraints if they don't exist
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_logs_workflow_id_fkey') THEN
            ALTER TABLE public.workflow_logs 
            ADD CONSTRAINT workflow_logs_workflow_id_fkey 
            FOREIGN KEY (workflow_id) 
            REFERENCES public.email_workflows(id) 
            ON DELETE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_logs_tenant_id_fkey') THEN
            ALTER TABLE public.workflow_logs 
            ADD CONSTRAINT workflow_logs_tenant_id_fkey 
            FOREIGN KEY (tenant_id) 
            REFERENCES public.tenants(id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_logs_application_id_fkey') THEN
            ALTER TABLE public.workflow_logs 
            ADD CONSTRAINT workflow_logs_application_id_fkey 
            FOREIGN KEY (application_id) 
            REFERENCES public.applications(id);
        END IF;
    END IF;

    -- Enable RLS on both tables
    ALTER TABLE public.email_workflows ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

    -- Create policies if they don't exist
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'email_workflows' AND policyname = 'agents_select_own_workflows') THEN
        CREATE POLICY "agents_select_own_workflows" 
        ON public.email_workflows 
        FOR SELECT 
        USING (agent_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'email_workflows' AND policyname = 'agents_insert_own_workflows') THEN
        CREATE POLICY "agents_insert_own_workflows" 
        ON public.email_workflows 
        FOR INSERT 
        WITH CHECK (agent_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'email_workflows' AND policyname = 'agents_update_own_workflows') THEN
        CREATE POLICY "agents_update_own_workflows" 
        ON public.email_workflows 
        FOR UPDATE 
        USING (agent_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'email_workflows' AND policyname = 'agents_delete_own_workflows') THEN
        CREATE POLICY "agents_delete_own_workflows" 
        ON public.email_workflows 
        FOR DELETE 
        USING (agent_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'workflow_logs' AND policyname = 'agents_view_own_workflow_logs') THEN
        CREATE POLICY "agents_view_own_workflow_logs" 
        ON public.workflow_logs 
        FOR SELECT 
        USING (
            workflow_id IN (
                SELECT id FROM public.email_workflows 
                WHERE agent_id = auth.uid()
            )
        );
    END IF;
END
$$;

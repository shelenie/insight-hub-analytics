-- Register import-source-cleanup in the Edge Function security registry.
-- Archive/restore must be available to admins; destructive cleanup remains
-- superadmin-only inside the Edge Function.

do $$
declare
  registry_schema text;
  registry_name text;
  registry_table regclass;
  analytics_workspace_id uuid := '5ebbe435-fd79-44c3-834e-642e8fba00dc'::uuid;
  set_clauses text[] := array[
    'is_dangerous = true',
    'requires_audit_log = true'
  ];
  insert_columns text[] := array[
    'function_name',
    'is_dangerous',
    'requires_audit_log'
  ];
  insert_values text[] := array[
    quote_literal('import-source-cleanup'),
    'true',
    'true'
  ];
  conflict_predicate text := 'function_name = ''import-source-cleanup''';
begin
  select table_schema, table_name, format('%I.%I', table_schema, table_name)::regclass
    into registry_schema, registry_name, registry_table
  from information_schema.columns
  where table_schema = 'public'
    and column_name in ('function_name', 'is_dangerous', 'requires_audit_log')
  group by table_schema, table_name
  having count(distinct column_name) = 3
  order by case table_name
      when 'edge_function_security_registry' then 1
      when 'edge_function_access_registry' then 2
      when 'edge_function_registry' then 3
      when 'edge_functions_registry' then 4
      when 'edge_functions' then 5
      else 100
    end,
    table_name
  limit 1;

  if registry_table is null then
    raise exception 'Could not find Edge Function security registry table with function_name, is_dangerous, and requires_audit_log columns';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = registry_schema and table_name = registry_name and column_name = 'workspace_id') then
    set_clauses := set_clauses || format('workspace_id = %L::uuid', analytics_workspace_id);
    insert_columns := insert_columns || 'workspace_id';
    insert_values := insert_values || format('%L::uuid', analytics_workspace_id);
    conflict_predicate := conflict_predicate || format(' and workspace_id = %L::uuid', analytics_workspace_id);
  end if;

  if exists (select 1 from information_schema.columns where table_schema = registry_schema and table_name = registry_name and column_name = 'required_min_role') then
    set_clauses := set_clauses || 'required_min_role = ''admin''';
    insert_columns := insert_columns || 'required_min_role';
    insert_values := insert_values || quote_literal('admin');
  end if;

  if exists (select 1 from information_schema.columns where table_schema = registry_schema and table_name = registry_name and column_name = 'required_permission') then
    set_clauses := set_clauses || 'required_permission = null';
    insert_columns := insert_columns || 'required_permission';
    insert_values := insert_values || 'null';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = registry_schema and table_name = registry_name and column_name = 'status') then
    set_clauses := set_clauses || 'status = ''active''';
    insert_columns := insert_columns || 'status';
    insert_values := insert_values || quote_literal('active');
  end if;

  if exists (select 1 from information_schema.columns where table_schema = registry_schema and table_name = registry_name and column_name = 'updated_at') then
    set_clauses := set_clauses || 'updated_at = now()';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = registry_schema and table_name = registry_name and column_name = 'created_at') then
    insert_columns := insert_columns || 'created_at';
    insert_values := insert_values || 'now()';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = registry_schema and table_name = registry_name and column_name = 'updated_at') then
    insert_columns := insert_columns || 'updated_at';
    insert_values := insert_values || 'now()';
  end if;

  execute format('update %s set %s where %s', registry_table, array_to_string(set_clauses, ', '), conflict_predicate);

  if not found then
    execute format('insert into %s (%s) values (%s)', registry_table, array_to_string(insert_columns, ', '), array_to_string(insert_values, ', '));
  end if;
end $$;

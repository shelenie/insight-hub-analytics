-- Register binding-create-or-update in the production Edge Function security registry.
--
-- Validation context:
-- Before this migration, public.check_edge_function_access_by_email(
--   p_workspace_id := '5ebbe435-fd79-44c3-834e-642e8fba00dc',
--   p_function_name := 'binding-create-or-update',
--   p_actor_email := 'olenashepel.ai@gmail.com'
-- ) returned allowed = false with result_reason = function_not_registered.
-- After this migration, the same check should allow workspace admins/superadmins
-- and continue denying member/anon users through the central access checker.

do $$
declare
  registry_schema text;
  registry_name text;
  registry_table regclass;
  set_clauses text[] := array[
    'is_dangerous = false',
    'requires_audit_log = true'
  ];
  insert_columns text[] := array[
    'function_name',
    'is_dangerous',
    'requires_audit_log'
  ];
  insert_values text[] := array[
    quote_literal('binding-create-or-update'),
    'false',
    'true'
  ];
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

  if exists (
    select 1
    from information_schema.columns
    where table_schema = registry_schema
      and table_name = registry_name
      and column_name = 'required_min_role'
  ) then
    set_clauses := set_clauses || 'required_min_role = ''admin''';
    insert_columns := insert_columns || 'required_min_role';
    insert_values := insert_values || quote_literal('admin');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = registry_schema
      and table_name = registry_name
      and column_name = 'required_permission'
  ) then
    set_clauses := set_clauses || 'required_permission = null';
    insert_columns := insert_columns || 'required_permission';
    insert_values := insert_values || 'null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = registry_schema
      and table_name = registry_name
      and column_name = 'updated_at'
  ) then
    set_clauses := set_clauses || 'updated_at = now()';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = registry_schema
      and table_name = registry_name
      and column_name = 'created_at'
  ) then
    insert_columns := insert_columns || 'created_at';
    insert_values := insert_values || 'now()';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = registry_schema
      and table_name = registry_name
      and column_name = 'updated_at'
  ) then
    insert_columns := insert_columns || 'updated_at';
    insert_values := insert_values || 'now()';
  end if;

  execute format(
    'update %s set %s where function_name = %L',
    registry_table,
    array_to_string(set_clauses, ', '),
    'binding-create-or-update'
  );

  if not found then
    execute format(
      'insert into %s (%s) values (%s)',
      registry_table,
      array_to_string(insert_columns, ', '),
      array_to_string(insert_values, ', ')
    );
  end if;
end $$;

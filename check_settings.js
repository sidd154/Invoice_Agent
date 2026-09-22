const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = 'https://acbymfzwsugaxrnvqrsh.supabase.co';
  const supabaseKey = 'sb_publishable_cMhDmhVTjD9EJGRAIEKfnw_ykY5gKVa';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Querying global_settings...');
  const { data, error } = await supabase.from('global_settings').select('*');
  console.log('global_settings data:', data);
}

main().catch(console.error);

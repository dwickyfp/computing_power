import re

def verify(sql, table_name, source_prefix):
    print(f"Original: {sql}")
    
    # Logic from pipeline.py
    rewritten_sql = sql
    table_pattern = re.compile(rf'(?<![\.\w"]){re.escape(table_name)}(?![\.\w"])', re.IGNORECASE)
    rewritten_sql = table_pattern.sub(f"{source_prefix}.{table_name}", rewritten_sql)
    
    print(f"Rewritten: {rewritten_sql}")
    return rewritten_sql

source_prefix = "pg_src_mysource"
table_name = "tbl_sales"

# Case 1: Simple
assert verify("SELECT * FROM tbl_sales", table_name, source_prefix) == "SELECT * FROM pg_src_mysource.tbl_sales"

# Case 2: With alias
assert verify("SELECT * FROM tbl_sales t", table_name, source_prefix) == "SELECT * FROM pg_src_mysource.tbl_sales t"

# Case 3: Already prefixed
assert verify("SELECT * FROM public.tbl_sales", table_name, source_prefix) == "SELECT * FROM public.tbl_sales"

# Case 4: Quoted (Current behavior: Ignored)
# verify("SELECT * FROM \"tbl_sales\"", table_name, source_prefix) 

# Case 5: Similar name
assert verify("SELECT * FROM tbl_sales_2", table_name, source_prefix) == "SELECT * FROM tbl_sales_2"

print("All assertions passed!")

import psycopg2
from datetime import datetime

conn = psycopg2.connect(
    host='localhost',
    port=5433,
    user='postgres',
    password='postgres',
    database='postgres'
)

with conn.cursor() as cur:
    cur.execute('SELECT COUNT(*) FROM worker_health_status')
    count = cur.fetchone()[0]
    print(f'Total records: {count}')
    
    if count > 0:
        cur.execute('''
            SELECT healthy, active_workers, active_tasks, reserved_tasks, 
                   error_message, last_check_at 
            FROM worker_health_status 
            ORDER BY last_check_at DESC LIMIT 1
        ''')
        row = cur.fetchone()
        print(f'Latest record:')
        print(f'  Healthy: {row[0]}')
        print(f'  Active workers: {row[1]}')
        print(f'  Active tasks: {row[2]}')
        print(f'  Reserved tasks: {row[3]}')
        print(f'  Error: {row[4]}')
        print(f'  Last check: {row[5]}')
        if row[5]:
            age = (datetime.now() - row[5]).total_seconds()
            print(f'  Age: {age:.1f} seconds')
    else:
        print('No records - background task not running')

conn.close()

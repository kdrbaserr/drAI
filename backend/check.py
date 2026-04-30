import sqlalchemy
try:
    url = 'postgresql://postgres:Kdrbaserr44.@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require'
    engine = sqlalchemy.create_engine(url)
    conn = engine.connect()
    print('SUCCESS with dot + ssl + POOLER!')
except Exception as e:
    print('ERROR1:', str(e))

try:
    url = 'postgresql://postgres.qysagkxmiaijspeknofm:Kdrbaserr44.@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require'
    engine = sqlalchemy.create_engine(url)
    conn = engine.connect()
    print('SUCCESS with DOT + ssl + POOLER + project ref user!')
except Exception as e:
    print('ERROR2:', str(e))

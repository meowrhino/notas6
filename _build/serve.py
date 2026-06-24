#!/usr/bin/env python3
# servidor estático para previsualizar notas6 (evita os.getcwd del sandbox)
import http.server, socketserver, functools

D = '/Users/meowrhino/Desktop/notas6'
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=D)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', 8765), Handler) as s:
    print('serving notas6 on http://127.0.0.1:8765')
    s.serve_forever()

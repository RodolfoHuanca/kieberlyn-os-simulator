import threading, time, random

def simular(n_segundos: int = 5, n: int = 5) -> dict:
    log = []
    tenedores = [threading.Semaphore(1) for _ in range(n)]
    arbitro = threading.Semaphore(n - 1)  # evita deadlock
    fin = threading.Event()

    def filosofo(i):
        while not fin.is_set():
            log.append({"t": round(time.time()-t0,2), "actor":f"Fil-{i}", "evento":"pensando"})
            time.sleep(random.uniform(0.1,0.3))
            arbitro.acquire()
            tenedores[i].acquire()
            tenedores[(i+1)%n].acquire()
            log.append({"t": round(time.time()-t0,2), "actor":f"Fil-{i}", "evento":"comiendo"})
            time.sleep(random.uniform(0.1,0.3))
            tenedores[i].release()
            tenedores[(i+1)%n].release()
            arbitro.release()

    t0 = time.time()
    threads = [threading.Thread(target=filosofo, args=(i,)) for i in range(n)]
    for th in threads: th.daemon = True; th.start()
    time.sleep(n_segundos)
    fin.set()
    return {"log": log[:50]}
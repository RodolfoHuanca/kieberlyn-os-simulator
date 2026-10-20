import threading, time, random

INGREDIENTES = ["tabaco", "papel", "fosforos"]

def simular(n_segundos: int = 5) -> dict:
    log = []
    agente_sem = threading.Semaphore(1)
    fum_sem = [threading.Semaphore(0) for _ in range(3)]
    fin = threading.Event()

    def fumador(i):
        while not fin.is_set():
            fum_sem[i].acquire()
            log.append({"t": round(time.time()-t0,2), "actor":f"Fumador-{i}", "evento":f"fuma (tiene {INGREDIENTES[i]})"})
            time.sleep(random.uniform(0.2,0.5))
            agente_sem.release()

    def agente():
        while not fin.is_set():
            agente_sem.acquire()
            i = random.randint(0, 2)
            ingredientes = [INGREDIENTES[j] for j in range(3) if j != i]
            log.append({"t": round(time.time()-t0,2), "actor":"Agente", "evento":f"pone {ingredientes[0]} y {ingredientes[1]}"})
            fum_sem[i].release()

    t0 = time.time()
    threads = [threading.Thread(target=fumador, args=(i,), daemon=True) for i in range(3)]
    threads.append(threading.Thread(target=agente, daemon=True))
    for th in threads: th.start()
    time.sleep(n_segundos)
    fin.set()
    return {"log": log[:50]}
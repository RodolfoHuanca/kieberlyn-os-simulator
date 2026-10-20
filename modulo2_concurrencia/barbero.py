import threading, time, random

def simular(n_segundos: int = 5, sillas: int = 3) -> dict:
    log = []
    clientes_sem = threading.Semaphore(0)
    barbero_sem = threading.Semaphore(0)
    mutex = threading.Semaphore(1)
    esperando = [0]
    fin = threading.Event()
    cliente_id = [0]

    def barbero():
        while not fin.is_set():
            clientes_sem.acquire()
            mutex.acquire()
            esperando[0] -= 1
            mutex.release()
            barbero_sem.release()
            log.append({"t": round(time.time()-t0,2), "actor":"Barbero", "evento":"cortando pelo"})
            time.sleep(random.uniform(0.3,0.6))

    def cliente(id):
        mutex.acquire()
        if esperando[0] < sillas:
            esperando[0] += 1
            log.append({"t": round(time.time()-t0,2), "actor":f"Cliente-{id}", "evento":"espera en silla"})
            mutex.release()
            clientes_sem.release()
            barbero_sem.acquire()
            log.append({"t": round(time.time()-t0,2), "actor":f"Cliente-{id}", "evento":"siendo atendido"})
        else:
            log.append({"t": round(time.time()-t0,2), "actor":f"Cliente-{id}", "evento":"se va (lleno)"})
            mutex.release()

    def generador():
        while not fin.is_set():
            time.sleep(random.uniform(0.2,0.5))
            cliente_id[0] += 1
            threading.Thread(target=cliente, args=(cliente_id[0],), daemon=True).start()

    t0 = time.time()
    threading.Thread(target=barbero, daemon=True).start()
    threading.Thread(target=generador, daemon=True).start()
    time.sleep(n_segundos)
    fin.set()
    return {"log": log[:50]}
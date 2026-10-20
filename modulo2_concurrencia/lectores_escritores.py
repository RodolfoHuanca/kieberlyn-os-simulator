import threading, time, random

def simular(n_segundos: int = 5, n_lectores: int = 3) -> dict:
    log = []
    mutex = threading.Semaphore(1)
    escritura = threading.Semaphore(1)
    lectores = [0]
    fin = threading.Event()

    def lector(id):
        while not fin.is_set():
            mutex.acquire()
            lectores[0] += 1
            if lectores[0] == 1: escritura.acquire()
            mutex.release()
            log.append({"t": round(time.time()-t0,2), "actor":f"Lector-{id}", "evento":"leyendo"})
            time.sleep(random.uniform(0.1,0.3))
            mutex.acquire()
            lectores[0] -= 1
            if lectores[0] == 0: escritura.release()
            mutex.release()
            time.sleep(random.uniform(0.1,0.2))

    def escritor():
        while not fin.is_set():
            escritura.acquire()
            log.append({"t": round(time.time()-t0,2), "actor":"Escritor", "evento":"escribiendo"})
            time.sleep(random.uniform(0.2,0.4))
            escritura.release()
            time.sleep(random.uniform(0.3,0.6))

    t0 = time.time()
    threads = [threading.Thread(target=lector, args=(i,)) for i in range(n_lectores)]
    threads.append(threading.Thread(target=escritor))
    for th in threads: th.daemon = True; th.start()
    time.sleep(n_segundos)
    fin.set()
    return {"log": log[:50]}
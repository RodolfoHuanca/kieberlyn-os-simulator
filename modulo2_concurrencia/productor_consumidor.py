import threading, time, random

def simular(n_segundos: int = 5, capacidad: int = 5) -> dict:
    buffer, log = [], []
    mutex = threading.Semaphore(1)
    vacio = threading.Semaphore(capacidad)
    lleno = threading.Semaphore(0)
    fin = threading.Event()
    item = [0]

    def productor():
        while not fin.is_set():
            vacio.acquire()
            mutex.acquire()
            item[0] += 1
            buffer.append(item[0])
            log.append({"t": round(time.time()-t0,2), "actor":"Productor", "evento":f"produce item {item[0]}", "buffer": len(buffer)})
            mutex.release()
            lleno.release()
            time.sleep(random.uniform(0.1,0.4))

    def consumidor():
        while not fin.is_set():
            lleno.acquire()
            mutex.acquire()
            if buffer:
                x = buffer.pop(0)
                log.append({"t": round(time.time()-t0,2), "actor":"Consumidor", "evento":f"consume item {x}", "buffer": len(buffer)})
            mutex.release()
            vacio.release()
            time.sleep(random.uniform(0.2,0.5))

    t0 = time.time()
    threads = [threading.Thread(target=productor), threading.Thread(target=consumidor)]
    for th in threads: th.daemon = True; th.start()
    time.sleep(n_segundos)
    fin.set()
    return {"log": log[:50]}
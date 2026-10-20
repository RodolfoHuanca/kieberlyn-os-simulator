from modulo1_planificacion.proceso import Proceso
from collections import deque
from copy import deepcopy

def simular(procesos: list[Proceso], quantum: int = 4, **kwargs):
    procs = sorted(deepcopy(procesos), key=lambda p: p.llegada)
    gantt, log = [], []
    tiempo = 0
    cola = deque()
    pendientes = list(procs)
    terminados = []
    en_cola = set()

    def encolar_nuevos():
        for p in list(pendientes):
            if p.llegada <= tiempo and p.pid not in en_cola:
                cola.append(p)
                en_cola.add(p.pid)
                log.append(f"t={tiempo}: llega {p.pid} ({p.nombre}). Entra a cola.")

    encolar_nuevos()

    while cola or any(p not in terminados for p in procs):
        if not cola:
            proximos = [p for p in pendientes if p.pid not in en_cola]
            if not proximos:
                break
            tiempo = min(p.llegada for p in proximos)
            encolar_nuevos()
            if not cola:
                break

        p = cola.popleft()
        if p.t_inicio == -1:
            p.t_inicio = tiempo

        ejecutar = min(quantum, p.rafaga_restante)
        log.append(f"t={tiempo}: ejecuta {p.pid} por {ejecutar} unidades (quantum={quantum}, restante={p.rafaga_restante}).")
        for t in range(ejecutar):
            gantt.append({"pid": p.pid, "t": tiempo + t})
        tiempo += ejecutar
        p.rafaga_restante -= ejecutar
        p.tiempo_cpu += ejecutar
        encolar_nuevos()

        if p.rafaga_restante == 0:
            p.t_fin = tiempo
            p.calcular_metricas()
            terminados.append(p)
            if p in pendientes:
                pendientes.remove(p)
            log.append(f"t={tiempo}: termina {p.pid}. TR={p.tr}, TE={p.te}.")
        else:
            log.append(f"t={tiempo}: {p.pid} agota quantum, vuelve a cola. Restante={p.rafaga_restante}.")
            cola.append(p)

    return _resultado(gantt, terminados, log)

def _resultado(gantt, procs, log):
    tabla = [p.to_dict() for p in procs]
    te = sum(p.te for p in procs) / len(procs)
    tr = sum(p.tr for p in procs) / len(procs)
    return {"gantt": gantt, "tabla": tabla, "log": log,
            "te_promedio": round(te, 2), "tr_promedio": round(tr, 2)}
from modulo1_planificacion.proceso import Proceso
from collections import deque
from copy import deepcopy

def simular(procesos: list[Proceso], quantum: int = 4, **kwargs):
    procs = sorted(deepcopy(procesos), key=lambda p: p.llegada)
    quantums = [quantum, quantum * 2, quantum * 4]
    colas = [deque(), deque(), deque()]
    gantt, log = [], []
    tiempo = 0
    terminados = []
    pendientes = list(procs)
    en_cola = set()

    def encolar_nuevos():
        for p in list(pendientes):
            if p.llegada <= tiempo and p.pid not in en_cola:
                colas[0].append(p)
                en_cola.add(p.pid)
                log.append(f"t={tiempo}: llega {p.pid} ({p.nombre}). Entra a cola Q0 (quantum={quantums[0]}).")

    encolar_nuevos()

    while len(terminados) < len(procs):
        ejecutado = False
        for nivel, cola in enumerate(colas):
            if not cola:
                continue
            p = cola.popleft()
            if p.t_inicio == -1:
                p.t_inicio = tiempo
            q = quantums[nivel]
            ejecutar = min(q, p.rafaga_restante)
            log.append(f"t={tiempo}: ejecuta {p.pid} en Q{nivel} (quantum={q}) por {ejecutar} unidades.")
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
                siguiente = min(nivel + 1, 2)
                colas[siguiente].append(p)
                log.append(f"t={tiempo}: {p.pid} degrada a Q{siguiente} (quantum={quantums[siguiente]}).")
            ejecutado = True
            break

        if not ejecutado:
            if pendientes:
                tiempo = min(p.llegada for p in pendientes if p.pid not in en_cola)
                encolar_nuevos()
            else:
                break

    return _resultado(gantt, terminados, log)

def _resultado(gantt, procs, log):
    tabla = [p.to_dict() for p in procs]
    te = sum(p.te for p in procs) / len(procs)
    tr = sum(p.tr for p in procs) / len(procs)
    return {"gantt": gantt, "tabla": tabla, "log": log,
            "te_promedio": round(te, 2), "tr_promedio": round(tr, 2)}
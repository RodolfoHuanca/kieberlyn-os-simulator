from modulo1_planificacion.proceso import Proceso
from copy import deepcopy

def simular(procesos: list[Proceso], **kwargs):
    procs = deepcopy(procesos)
    gantt, log = [], []
    tiempo = 0
    terminados = []
    ultimo = None

    while len(terminados) < len(procs):
        disponibles = [p for p in procs if p.llegada <= tiempo and p.rafaga_restante > 0]
        if not disponibles:
            tiempo += 1
            continue
        p = min(disponibles, key=lambda x: x.rafaga_restante)
        if p.t_inicio == -1:
            p.t_inicio = tiempo
        if p != ultimo:
            log.append(f"t={tiempo}: expulsa a anterior. Selecciona {p.pid} ({p.nombre}, restante={p.rafaga_restante}) — menor ráfaga restante.")
            ultimo = p
        gantt.append({"pid": p.pid, "t": tiempo})
        p.rafaga_restante -= 1
        p.tiempo_cpu += 1
        tiempo += 1
        if p.rafaga_restante == 0:
            p.t_fin = tiempo
            p.calcular_metricas()
            terminados.append(p)
            log.append(f"t={tiempo}: termina {p.pid}. TR={p.tr}, TE={p.te}.")
            ultimo = None

    return _resultado(gantt, terminados, log)

def _resultado(gantt, procs, log):
    tabla = [p.to_dict() for p in procs]
    te = sum(p.te for p in procs) / len(procs)
    tr = sum(p.tr for p in procs) / len(procs)
    return {"gantt": gantt, "tabla": tabla, "log": log,
            "te_promedio": round(te, 2), "tr_promedio": round(tr, 2)}
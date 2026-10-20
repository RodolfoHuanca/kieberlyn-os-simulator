from modulo1_planificacion.proceso import Proceso

def simular(procesos: list[Proceso], **kwargs):
    procs = sorted(procesos, key=lambda p: (p.llegada, p.pid))
    gantt = []
    log   = []
    tiempo = 0

    for p in procs:
        if tiempo < p.llegada:
            log.append(f"t={tiempo}: CPU ociosa hasta t={p.llegada}")
            tiempo = p.llegada
        log.append(f"t={tiempo}: llega {p.pid} ({p.nombre}, ráfaga={p.rafaga}). Entra a CPU.")
        p.t_inicio = tiempo
        for t in range(p.rafaga):
            gantt.append({"pid": p.pid, "t": tiempo + t})
        tiempo += p.rafaga
        p.t_fin = tiempo
        p.calcular_metricas()
        log.append(f"t={tiempo}: termina {p.pid}. TR={p.tr}, TE={p.te}.")

    return _resultado(gantt, procs, log)

def _resultado(gantt, procs, log):
    tabla = [p.to_dict() for p in procs]
    te = sum(p.te for p in procs) / len(procs)
    tr = sum(p.tr for p in procs) / len(procs)
    return {"gantt": gantt, "tabla": tabla, "log": log,
            "te_promedio": round(te, 2), "tr_promedio": round(tr, 2)}
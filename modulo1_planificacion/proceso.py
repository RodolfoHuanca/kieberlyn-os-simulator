# modulo1_planificacion/proceso.py
from dataclasses import dataclass, field

@dataclass
class Proceso:
    pid: str
    nombre: str
    llegada: int
    rafaga: int
    prioridad: int = 2      # 1=alta 2=media 3=baja
    memoria: int = 0
    tipo: str = "cpu"       # cpu | io

    # runtime
    rafaga_restante: int = field(init=False)
    estado: str = field(default="nuevo", init=False)
    te: int = field(default=0, init=False)
    tr: int = field(default=0, init=False)
    t_inicio: int = field(default=-1, init=False)
    t_fin: int = field(default=0, init=False)
    tiempo_cpu: int = field(default=0, init=False)

    def __post_init__(self):
        self.rafaga_restante = self.rafaga

    def calcular_metricas(self):
        self.tr = self.t_fin - self.llegada
        self.te = self.tr - self.rafaga

    def to_dict(self):
        return {
            "pid": self.pid,
            "nombre": self.nombre,
            "llegada": self.llegada,
            "rafaga": self.rafaga,
            "prioridad": self.prioridad,
            "memoria": self.memoria,
            "tipo": self.tipo,
            "estado": self.estado,
            "te": self.te,
            "tr": self.tr,
            "t_inicio": self.t_inicio,
            "t_fin": self.t_fin,
            "tiempo_cpu": self.tiempo_cpu,
        }

def from_dict(d: dict) -> Proceso:
    return Proceso(
        pid=d["pid"],
        nombre=d.get("nombre", d["pid"]),
        llegada=int(d["llegada"]),
        rafaga=int(d["rafaga"]),
        prioridad=int(d.get("prioridad", 2)),
        memoria=int(d.get("memoria", 0)),
        tipo=d.get("tipo", "cpu"),
    )
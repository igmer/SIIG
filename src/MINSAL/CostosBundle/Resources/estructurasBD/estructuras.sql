-- Creación de nuevos esquemas
CREATE SCHEMA IF NOT EXISTS costos;
CREATE SCHEMA IF NOT EXISTS catalogos;
CREATE SCHEMA IF NOT EXISTS temporales;

-- Cración de las datos que contendrán los datos leidos de los orígenes
CREATE TABLE IF NOT EXISTS fila_origen_dato_aux(
    id_origen_dato integer,
    datos hstore,
    ultima_lectura timestamp,

    FOREIGN KEY (id_origen_dato) REFERENCES origen_datos(id) on update CASCADE on delete CASCADE
);

CREATE TABLE IF NOT EXISTS costos.fila_origen_dato_rrhh(
    id_origen_dato integer,
    datos hstore,
    ultima_lectura timestamp,

    FOREIGN KEY (id_origen_dato) REFERENCES origen_datos(id) on update CASCADE on delete CASCADE
);



-- ********************** PROCEDIMIENTOS

-- RRHH
CREATE OR REPLACE FUNCTION costo_rrhh() RETURNS TRIGGER AS $costo_rrhh$
  DECLARE    
    limite_isss numeric := 685.71;
    isss_porc_patronal numeric := 0.075;

    limite_ipsfa numeric := 2449.05;
    ipsfa_porc_patronal numeric := 0.06;

    afp_porc_patronal numeric := 0.0675;
    limite_afp numeric := 5467.52;

    salario  numeric := 0;
    salario_descuentos_permisos  numeric := 0;
    isss_patronal numeric := 0;
    tipo_fondo_proteccion  varchar;
    
    fondo_proteccion numeric := 0;
    porc_fondo_proteccion numeric := 0;
    limit_fondo_proteccion numeric := 0;

    costo_con_aporte_y_aguinaldo numeric :=0;
    costo_hora_con_aporte_y_aguinaldo numeric :=0;
    costo_hora_no_trab_CG numeric :=0;
    costo_hora_no_trab_SG numeric :=0;
    costo_hora_descuentos_permisos numeric :=0;

    horas_trabajadas_mes numeric :=0;
    horas_trabajadas_sg numeric :=0;
    dependencias_donde_labora numeric :=0;
    aguinaldo numeric :=0;
    descuentos numeric :=0;
    horas_no_trab_CG numeric :=0;
    horas_no_trab_SG numeric :=0;
    
  BEGIN   
    salario := (COALESCE(NULLIF(NEW.datos->'salario', ''),'0'))::numeric ;
    descuentos := (COALESCE(NULLIF(NEW.datos->'descuentos',''),'0'))::numeric ;
    tipo_fondo_proteccion := (COALESCE(NULLIF(NEW.datos->'fondo_proteccion', ''),''));
    horas_trabajadas_mes := (COALESCE(NULLIF(NEW.datos->'horas_trabajadas_mes', ''),'0'))::numeric;
    dependencias_donde_labora := (COALESCE(NULLIF(NEW.datos->'dependencias_donde_labora',''),'0'))::numeric;
    horas_trabajadas_sg := (COALESCE(NULLIF(NEW.datos->'horas_trabajadas_sg',''),'0'))::numeric;
    aguinaldo := (COALESCE(NULLIF(NEW.datos->'aguinaldo', ''),'0'))::numeric;
    horas_no_trab_CG := (COALESCE(NULLIF(NEW.datos->'horas_no_trab_CG', ''),'0'))::numeric;
    horas_no_trab_SG := (COALESCE(NULLIF(NEW.datos->'horas_no_trab_SG', ''),'0'))::numeric;

     
    IF UPPER(tipo_fondo_proteccion) = 'AFP' THEN
        porc_fondo_proteccion := afp_porc_patronal;
        limit_fondo_proteccion := limite_afp;
    ELSEIF UPPER(tipo_fondo_proteccion) = 'IPSFA' THEN
        porc_fondo_proteccion := ipsfa_porc_patronal;
        limit_fondo_proteccion := limite_ipsfa;
    END IF;
    
    IF (salario > limit_fondo_proteccion) THEN
        fondo_proteccion := limit_fondo_proteccion * porc_fondo_proteccion;
    ELSE
        fondo_proteccion := salario * porc_fondo_proteccion;
    END IF;
    
    
    IF (salario > limite_isss) THEN
        isss_patronal := limite_isss * isss_porc_patronal;
    ELSE
        isss_patronal := salario * isss_porc_patronal;
    END IF;

    IF horas_trabajadas_mes > 0 THEN        
        IF dependencias_donde_labora >= 2 THEN
            costo_con_aporte_y_aguinaldo := isss_patronal + fondo_proteccion + 
            (salario - ((salario / horas_trabajadas_mes) * horas_trabajadas_sg) + 
            aguinaldo) / dependencias_donde_labora;
        ELSE
            costo_con_aporte_y_aguinaldo := salario - (( salario / horas_trabajadas_mes) 
            * horas_trabajadas_sg) + isss_patronal + fondo_proteccion +  aguinaldo; 
        END IF;
        costo_hora_con_aporte_y_aguinaldo := costo_con_aporte_y_aguinaldo / horas_trabajadas_mes;
    ELSE
        costo_con_aporte_y_aguinaldo := 0;
        costo_hora_con_aporte_y_aguinaldo := 0;
    END IF;

    IF horas_trabajadas_mes = horas_no_trab_CG  THEN
        costo_hora_no_trab_CG :=  costo_hora_con_aporte_y_aguinaldo;
    ELSE
        costo_hora_no_trab_CG := horas_no_trab_CG * costo_hora_con_aporte_y_aguinaldo;
    END IF;

    IF (horas_trabajadas_mes = horas_no_trab_SG)  OR horas_trabajadas_mes = 0 THEN
        costo_hora_no_trab_SG :=  0;
    ELSE
        costo_hora_no_trab_SG := horas_no_trab_SG * (salario / horas_trabajadas_mes);
    END IF;

    salario_descuentos_permisos := costo_con_aporte_y_aguinaldo - descuentos;

    IF horas_trabajadas_mes = horas_no_trab_CG THEN
        costo_hora_descuentos_permisos := salario_descuentos_permisos;
    ELSEIF horas_trabajadas_mes > 0 THEN
        costo_hora_descuentos_permisos := salario_descuentos_permisos / horas_trabajadas_mes;
    ELSE
        costo_hora_descuentos_permisos := 0;
    END IF;

    NEW.datos := NEW.datos || ('"isss_patronal"=>"'||isss_patronal||'"')::hstore;
    NEW.datos := NEW.datos || ('"fondo_proteccion"=>"'||fondo_proteccion||'"')::hstore;
    NEW.datos := NEW.datos || ('"costo_con_aporte_y_aguinaldo"=>"'||( salario + isss_patronal + fondo_proteccion + aguinaldo )||'"')::hstore;
    NEW.datos := NEW.datos || ('"costo_hora_aporte_aguinaldo"=>"'||costo_hora_con_aporte_y_aguinaldo||'"')::hstore;
    NEW.datos := NEW.datos || ('"costo_hora_no_trab_CG"=>"'||costo_hora_no_trab_CG||'"')::hstore;
    NEW.datos := NEW.datos || ('"costo_hora_no_trab_SG"=>"'||costo_hora_no_trab_SG||'"')::hstore;
    NEW.datos := NEW.datos || ('"salario_descuentos_permisos"=>"'||salario_descuentos_permisos||'"')::hstore;
    NEW.datos := NEW.datos || ('"costo_hora_descuentos_permisos"=>"'||costo_hora_descuentos_permisos||'"')::hstore;
   RETURN NEW;
  END;
$costo_rrhh$ LANGUAGE plpgsql;


--                   
      --                  '", ""=>"'||||
       --                 '", ""=>"'||||
        --                '", ""=>"'||||
         --               '", ""=>"'||||
          --              '", ""=>"'||||

CREATE TRIGGER costo_rrhh BEFORE INSERT OR UPDATE 
    ON costos.fila_origen_dato_rrhh FOR EACH ROW 
    EXECUTE PROCEDURE costo_rrhh();
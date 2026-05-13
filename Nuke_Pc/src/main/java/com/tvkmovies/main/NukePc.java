package com.tvkmovies.main;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name="Pc_Compunents")
public class NukePc {
	
	@Id
	@GeneratedValue(strategy = GenerationType.AUTO)
	private Integer pc_id;
	
	private String customer;
	private String cpu_processor;
	private String motherboard;
	private String ram_memory;
	private String storage_drive;
	private String gpu_graphicscard;
	
	
	public NukePc( String customer, String cpu_processor, String motherboard, String ram_memory,
			String storage_drive, String gpu_graphicscard) {
		super();
		
		this.customer = customer;
		this.cpu_processor = cpu_processor;
		this.motherboard = motherboard;
		this.ram_memory = ram_memory;
		this.storage_drive = storage_drive;
		this.gpu_graphicscard = gpu_graphicscard;
	}


	public NukePc() {
		super();
	}



	public Integer getPc_id() {
		return pc_id;
	}


	public void setPc_id(Integer pc_id) {
		this.pc_id = pc_id;
	}


	public String getCustomer() {
		return customer;
	}


	public void setCustomer(String customer) {
		this.customer = customer;
	}


	public String getCpu_processor() {
		return cpu_processor;
	}


	public void setCpu_processor(String cpu_processor) {
		this.cpu_processor = cpu_processor;
	}


	public String getMotherboard() {
		return motherboard;
	}


	public void setMotherboard(String motherboard) {
		this.motherboard = motherboard;
	}


	public String getRam_memory() {
		return ram_memory;
	}


	public void setRam_memory(String ram_memory) {
		this.ram_memory = ram_memory;
	}


	public String getStorage_drive() {
		return storage_drive;
	}


	public void setStorage_drive(String storage_drive) {
		this.storage_drive = storage_drive;
	}


	public String getGpu_graphicscard() {
		return gpu_graphicscard;
	}


	public void setGpu_graphicscard(String gpu_graphicscard) {
		this.gpu_graphicscard = gpu_graphicscard;
	}
	
	
	

}

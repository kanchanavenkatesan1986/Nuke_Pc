package com.tvkmovies.main;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NukeRepository  extends JpaRepository<NukePc,Integer>{

}
